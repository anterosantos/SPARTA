// @ts-nocheck — Deno Edge Function
// VERSÃO DIAGNÓSTICA — isola web-push. NÃO importa web-push.
// Objetivo: provar se o hang de 150s vem do web-push ou do supabase-js/runtime.
// Faz claim das notificações, conta, e repõe-nas a 'scheduled' (preserva fixtures).
import { createClient } from "@supabase/supabase-js";

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`[timeout] ${label} excedeu ${ms}ms`)),
      ms
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[send-push:diag] start", {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
  });

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing env", supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  console.log("[send-push:diag] client created");

  try {
    console.log("[send-push:diag] claiming…");
    const { data: notifications, error: claimError } = await withTimeout(
      supabase.rpc("claim_push_notifications", { batch_size: 50 }),
      15_000,
      "claim"
    );

    if (claimError) {
      console.error("[send-push:diag] claim error:", claimError);
      return new Response(
        JSON.stringify({ error: "claim failed", details: claimError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const claimed = notifications ?? [];
    console.log("[send-push:diag] claimed:", claimed.length);

    // Repor a 'scheduled' para preservar as notificações para o teste real
    if (claimed.length > 0) {
      const ids = claimed.map((n) => n.id);
      await withTimeout(
        supabase.from("notification_log").update({ status: "scheduled" }).in("id", ids),
        15_000,
        "reset_to_scheduled"
      );
    }

    const response = {
      event: "send_push_diagnostic",
      mode: "no-webpush",
      claimed: claimed.length,
      sample: claimed.slice(0, 3).map((n) => ({ id: n.id, kind: n.kind, profile_id: n.profile_id })),
    };
    console.log("[send-push:diag] done:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-push:diag] unexpected:", String(error));
    return new Response(
      JSON.stringify({ error: "internal", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export default handler;
