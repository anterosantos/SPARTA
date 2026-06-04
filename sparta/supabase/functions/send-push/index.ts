// @ts-nocheck — Deno Edge Function
// PING DIAGNÓSTICO v2 — usa Deno.serve (entrypoint nativo da runtime Supabase)
// em vez de `export default handler`. Testa se o padrão de export é a causa do
// hang de 150s que afeta TODAS as funções do projeto.
Deno.serve((req: Request): Response => {
  return new Response(
    JSON.stringify({
      ok: true,
      mode: "ping-deno-serve",
      method: req.method,
      ts: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
