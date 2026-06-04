// @ts-nocheck — Deno Edge Function: Deno global não existe no tsconfig do Next.js
//
// ENTRYPOINT: Deno.serve(handler) — OBRIGATÓRIO. A runtime das edge functions do
// Supabase NÃO invoca `export default handler`; com esse padrão o isolate arranca
// mas o handler nunca corre, idle até ao kill de 150s (IDLE_TIMEOUT / 546).
//
// DB via supabase-js + service role (padrão de todas as functions do projeto),
// usando as RPCs claim_push_notifications / reset_stale_processing_notifications
// (migration 000230) para claim atómico com SKIP LOCKED.
//
// Push: NÃO usar webpush.sendNotification() — usa node:https que pendura no Deno.
// Em vez disso generateRequestDetails() (só crypto) + fetch().
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

interface PushKeys {
  p256dh: string;
  auth: string;
}

function isValidPushKeys(keys: unknown): keys is PushKeys {
  if (!keys || typeof keys !== "object") return false;
  const k = keys as Record<string, unknown>;
  return typeof k["p256dh"] === "string" && typeof k["auth"] === "string" &&
    k["p256dh"].length > 0 && k["auth"].length > 0;
}

function extractHttpStatus(err: unknown): number {
  if (!err || typeof err !== "object") return 0;
  const e = err as Record<string, unknown>;
  if (typeof e["statusCode"] === "number") return e["statusCode"];
  if (typeof e["message"] === "string") {
    const match = (e["message"] as string).match(/\b(4\d{2}|5\d{2})\b/);
    if (match?.[1] !== undefined) return parseInt(match[1], 10);
  }
  return 0;
}

/** withTimeout — rejeita após `ms`; setTimeout funciona no runtime Deno do Supabase. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`[timeout] ${label} excedeu ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://sparta-webapp.vercel.app";

  console.log("[send-push] start:", {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
    hasVapidPublicKey: !!vapidPublicKey,
    hasVapidPrivateKey: !!vapidPrivateKey,
  });

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(
      JSON.stringify({
        error: "Missing environment variables",
        missing: {
          supabaseUrl: !supabaseUrl,
          serviceRoleKey: !serviceRoleKey,
          vapidPublicKey: !vapidPublicKey,
          vapidPrivateKey: !vapidPrivateKey,
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  webpush.setVapidDetails(siteUrl, vapidPublicKey, vapidPrivateKey);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Reset rows 'processing' bloqueadas há > 10 min (salvaguarda contra crashes)
    const { data: staleCount, error: staleError } = await withTimeout(
      supabase.rpc("reset_stale_processing_notifications", { stale_minutes: 10 }),
      15_000,
      "reset_stale"
    );
    if (staleError) console.warn("[send-push] reset_stale error:", staleError);
    else if ((staleCount ?? 0) > 0) console.warn(`[send-push] reset ${staleCount} stale rows`);

    // Claim atómico (FOR UPDATE SKIP LOCKED via RPC) — previne duplo envio
    const { data: notifications, error: claimError } = await withTimeout(
      supabase.rpc("claim_push_notifications", { batch_size: 50 }),
      15_000,
      "claim"
    );

    if (claimError) {
      console.error("[send-push] claim error:", claimError);
      return new Response(
        JSON.stringify({ error: "Failed to claim notifications", details: claimError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const claimed = notifications ?? [];
    console.log("[send-push] claimed:", claimed.length);

    let sent = 0, failed = 0, skipped = 0;

    for (const notif of claimed) {
      const { data: subs, error: subError } = await withTimeout(
        supabase
          .from("push_subscriptions")
          .select("id, endpoint, keys_json, is_active")
          .eq("profile_id", notif.profile_id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1),
        15_000,
        `fetch_sub:${notif.id}`
      );

      const subscription = subError ? null : (subs ?? [])[0];

      if (!subscription) {
        await supabase.from("notification_log").update({ status: "skipped" }).eq("id", notif.id);
        skipped++;
        continue;
      }

      const rawKeys = typeof subscription.keys_json === "string"
        ? (() => { try { return JSON.parse(subscription.keys_json); } catch { return null; } })()
        : subscription.keys_json;

      if (!isValidPushKeys(rawKeys)) {
        console.warn(`[send-push] invalid keys sub ${subscription.id} — deactivating`);
        await supabase.from("push_subscriptions").update({ is_active: false }).eq("endpoint", subscription.endpoint);
        await supabase.from("notification_log").update({ status: "failed", error_message: "Invalid push keys" }).eq("id", notif.id);
        failed++;
        continue;
      }

      let bodyText: string, deepLink: string, tag: string;

      if (notif.kind === "player_absence") {
        let playerFirstName = "Um jogador";
        if (notif.context_player_id) {
          const { data: player } = await withTimeout(
            supabase.from("players").select("full_name").eq("id", notif.context_player_id).maybeSingle(),
            15_000,
            `fetch_player:${notif.id}`
          );
          if (player?.full_name) {
            playerFirstName = (player.full_name as string).split(" ")[0] ?? player.full_name;
          }
        }
        bodyText = `${playerFirstName} declarou ausência para a sessão`;
        deepLink = `/sessoes/${notif.session_id}/presencas`;
        tag = "player-absence";
      } else {
        bodyText = notif.kind === "fatigue_pre"
          ? "Sessão daqui a pouco — abre o app"
          : "Sessão concluída — responde ao questionário";
        deepLink = `/questionario/${notif.session_id}/${notif.kind === "fatigue_pre" ? "pre" : "post"}`;
        tag = "fatigue-notification";
      }

      const payload = { title: "SPARTA", body: bodyText, tag, data: { deepLink } };

      try {
        const details = await webpush.generateRequestDetails(
          { endpoint: subscription.endpoint, keys: rawKeys },
          JSON.stringify(payload)
        );
        const pushResponse = await withTimeout(
          fetch(details.endpoint, {
            method: "POST",
            headers: details.headers as Record<string, string>,
            body: details.body ?? undefined,
          }),
          20_000,
          `push_fetch:${notif.id}`
        );
        if (pushResponse.status !== 201) {
          const e = new Error(`Push service returned ${pushResponse.status}`);
          (e as Record<string, unknown>)["statusCode"] = pushResponse.status;
          throw e;
        }
        await supabase.from("notification_log").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", notif.id);
        sent++;
        console.log(`[send-push] sent ${notif.id}`);
      } catch (pushError: unknown) {
        const statusCode = extractHttpStatus(pushError);
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from("push_subscriptions").update({ is_active: false }).eq("endpoint", subscription.endpoint);
          await supabase.from("notification_log").update({ status: "failed", error_message: `${statusCode} Gone` }).eq("id", notif.id);
          console.log(`[send-push] ${statusCode} — deactivated ${subscription.endpoint}`);
        } else {
          const msg = pushError instanceof Error ? pushError.message : "Unknown error";
          await supabase.from("notification_log").update({ status: "failed", error_message: msg.substring(0, 255) }).eq("id", notif.id);
          console.warn(`[send-push] push error ${notif.id} (status ${statusCode}):`, msg);
        }
        failed++;
      }
    }

    const response = { event: "send_push", processed: claimed.length, sent, failed, skipped };
    console.log("[send-push] done:", response);
    return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[send-push] unexpected error:", String(error));
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

Deno.serve(handler);
