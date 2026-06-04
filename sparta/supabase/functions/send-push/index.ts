// @ts-nocheck — Deno Edge Function
// PING DIAGNÓSTICO — zero imports, zero rede. Só devolve JSON imediatamente.
// Objetivo: provar se a runtime das edge functions arranca e responde de todo.
const handler = (req: Request): Response => {
  return new Response(
    JSON.stringify({
      ok: true,
      mode: "ping-no-network",
      method: req.method,
      ts: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export default handler;
