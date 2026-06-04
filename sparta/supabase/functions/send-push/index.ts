// @ts-nocheck — Deno Edge Function: Deno global não existe no tsconfig do Next.js
// Usa ligação directa ao PostgreSQL (postgresjs) em vez de supabase-js/PostgREST
// para evitar o deadlock HTTP que causa WORKER_RESOURCE_LIMIT de 150s.
import webpush from "web-push";
import postgres from "postgres";

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://sparta-webapp.vercel.app";

  console.log("[send-push] start:", {
    hasDbUrl: !!dbUrl,
    hasVapidPublicKey: !!vapidPublicKey,
    hasVapidPrivateKey: !!vapidPrivateKey,
  });

  if (!dbUrl || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables", missing: { dbUrl: !dbUrl, vapid: !vapidPublicKey } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  webpush.setVapidDetails(siteUrl, vapidPublicKey, vapidPrivateKey);

  // Ligação directa ao PostgreSQL — bypassa PostgREST/Kong que fica em deadlock
  // quando chamado de dentro de um edge function do mesmo projecto.
  const sql = postgres(dbUrl, {
    max: 1,
    ssl: "require",
    connect_timeout: 10,
    idle_timeout: 30,
  });

  try {
    // Reset rows 'processing' bloqueadas há > 10 min
    const [staleRow] = await sql`
      WITH reset AS (
        UPDATE notification_log
        SET
          status        = 'failed',
          error_message = 'Processing timeout — reset by cleanup'
        WHERE status = 'processing'
          AND created_at < now() - interval '10 minutes'
        RETURNING id
      )
      SELECT COUNT(*)::int AS count FROM reset
    `;
    const staleCount = staleRow?.count ?? 0;
    if (staleCount > 0) {
      console.warn(`[send-push] reset ${staleCount} stale 'processing' rows to 'failed'`);
    }

    // Claim notificações atomicamente (FOR UPDATE SKIP LOCKED previne duplo envio)
    const notifications = await sql`
      UPDATE notification_log
      SET status = 'processing'
      WHERE id IN (
        SELECT id FROM notification_log
        WHERE status = 'scheduled'
          AND scheduled_for <= now()
        ORDER BY scheduled_for ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, profile_id, session_id, kind, context_player_id
    `;

    console.log("[send-push] claimed:", notifications.length);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const notif of notifications) {
      // Fetch subscrição activa mais recente do perfil
      const [subscription] = await sql`
        SELECT id, endpoint, keys_json, is_active
        FROM push_subscriptions
        WHERE profile_id = ${notif.profile_id}
          AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!subscription) {
        await sql`UPDATE notification_log SET status = 'skipped' WHERE id = ${notif.id}`;
        skipped++;
        continue;
      }

      const rawKeys = typeof subscription.keys_json === "string"
        ? (() => { try { return JSON.parse(subscription.keys_json); } catch { return null; } })()
        : subscription.keys_json;

      if (!isValidPushKeys(rawKeys)) {
        console.warn(`[send-push] invalid keys_json for subscription ${subscription.id} — deactivating`);
        await sql`UPDATE push_subscriptions SET is_active = false WHERE endpoint = ${subscription.endpoint}`;
        await sql`
          UPDATE notification_log
          SET status = 'failed', error_message = 'Invalid push keys'
          WHERE id = ${notif.id}
        `;
        failed++;
        continue;
      }

      // Build payload
      let bodyText: string;
      let deepLink: string;
      let tag: string;

      if (notif.kind === "player_absence") {
        let playerFirstName = "Um jogador";
        if (notif.context_player_id) {
          const [player] = await sql`
            SELECT full_name FROM players WHERE id = ${notif.context_player_id}
          `;
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

      const payload = {
        title: "SPARTA",
        body: bodyText,
        tag,
        data: { deepLink },
      };

      try {
        // generateRequestDetails faz apenas crypto (sem I/O) — evita node:https
        const details = await webpush.generateRequestDetails(
          { endpoint: subscription.endpoint, keys: rawKeys },
          JSON.stringify(payload)
        );
        const pushResponse = await fetch(details.endpoint, {
          method: "POST",
          headers: details.headers as Record<string, string>,
          body: details.body ?? undefined,
          signal: AbortSignal.timeout(30_000),
        });
        if (pushResponse.status !== 201) {
          const err = new Error(`Push service returned ${pushResponse.status}`);
          (err as Record<string, unknown>)["statusCode"] = pushResponse.status;
          throw err;
        }

        await sql`
          UPDATE notification_log
          SET status = 'sent', sent_at = now()
          WHERE id = ${notif.id}
        `;
        sent++;
        console.log(`[send-push] sent ${notif.id}`);
      } catch (pushError: unknown) {
        const statusCode = extractHttpStatus(pushError);

        if (statusCode === 410 || statusCode === 404) {
          await sql`UPDATE push_subscriptions SET is_active = false WHERE endpoint = ${subscription.endpoint}`;
          await sql`
            UPDATE notification_log
            SET status = 'failed', error_message = ${`${statusCode} Gone`}
            WHERE id = ${notif.id}
          `;
          console.log(`[send-push] ${statusCode} — deactivated ${subscription.endpoint}`);
        } else {
          const errorMsg = pushError instanceof Error ? pushError.message : "Unknown error";
          await sql`
            UPDATE notification_log
            SET status = 'failed', error_message = ${errorMsg.substring(0, 255)}
            WHERE id = ${notif.id}
          `;
          console.warn(`[send-push] push error ${notif.id} (status ${statusCode}):`, errorMsg);
        }
        failed++;
      }
    }

    const response = {
      event: "send_push",
      processed: notifications.length,
      sent,
      failed,
      skipped,
    };
    console.log("[send-push] done:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-push] unexpected error:", String(error));
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
};

export default handler;
