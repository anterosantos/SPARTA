<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## TypeScript: Path Aliases (@/*)

The project uses TypeScript path aliases for clean imports. All `@/*` imports resolve to the `src/` directory.

**Configuration:**
- `tsconfig.json`: `"@/*": ["./src/*"]`
- `vitest.config.ts`: Absolute path via `path.resolve(__dirname, "./src")`
- `components.json` (shadcn): `"@/components"`, `"@/lib"`, `"@/hooks"`, etc.

**Rules:**
- Tests must run from `sparta/` directory (not repo root) for alias resolution
- Verify with: `npm run test --run`
- Import from aliases in tests: `import { cn } from "@/lib/utils"`

**Examples:**
```typescript
// ✅ Correct
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCustomHook } from "@/hooks/useCustomHook";

// ❌ Avoid relative imports (harder to refactor)
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
```

---

## React 19: Automatic JSX Transform

React 19 uses automatic JSX transform. You do NOT need to import React in `.tsx` files.

**Configuration:**
- `tsconfig.json`: `"jsx": "react-jsx"`
- `@vitejs/plugin-react`: Handles JSX for vitest/jsdom environment

**Rules:**
- No `import React from "react"` needed
- Vitest and Next.js dev server may render JSX differently; ensure compatibility
- See `__tests__/jsx-compat.test.tsx` for consistency test (if added)

**Examples:**
```typescript
// ✅ Correct (no React import needed)
export function MyComponent() {
  return <div>Hello</div>;
}

// ⚠️ Avoid (React import unnecessary in React 19)
import React from "react";
export function MyComponent() {
  return <div>Hello</div>;
}
```

---

## TypeScript: noUncheckedIndexedAccess (NFR55)

The project uses TypeScript strict mode with `noUncheckedIndexedAccess: true`. This means index access (array[i], object[key]) requires explicit type narrowing.

**The Rule:**
- Array/object index access must be guarded
- Use optional chaining (`?.`) + nullish coalescing (`??`)
- Or use explicit `in` checks / type guards

**Pattern: Optional Chaining + Nullish Coalescing**
```typescript
const arr = [1, 2, 3];
const value = arr?.[0] ?? 0; // ✅ Correct: safe fallback

const obj = { a: 1 };
const val = obj?.["key"] ?? undefined; // ✅ Correct

const key = "name";
const name = obj?.[key] ?? "Unknown"; // ✅ Correct
```

**Anti-Patterns:**
```typescript
// ❌ Error: may be undefined
const first = arr[0];

// ❌ Error: no guard
const val = obj[key];

// ❌ Error: no fallback
const name = obj?.[key]; // Still needs ?? fallback
```

**Type Guards:**
```typescript
// ✅ Correct: explicit check
if (arr[0] !== undefined) {
  console.log(arr[0]);
}

// ✅ Correct: in operator for objects
if ("key" in obj && obj.key) {
  console.log(obj.key);
}
```

See: [TypeScript noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig#noUncheckedIndexedAccess)

---

## Running Tests

Tests must be run from the `sparta/` directory for correct alias and setup resolution.

**From sparta/:**
```bash
npm run test          # Watch mode
npm run test --run    # Single run
npm run test:watch    # Explicit watch
```

**From repo root (monorepo style):**
```bash
npm run -w sparta test       # Watch mode
npm run -w sparta test --run # Single run
```

Vitest setup files are configured with absolute paths for compatibility.

---

## Environment Variables

Use `.env.local` (gitignored) for local development secrets. Template: `.env.example`

**Setup:**
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

**Required variables (Story 1.2):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (renamed from `ANON_KEY` in 2025+)

Public variables (prefixed `NEXT_PUBLIC_`) are exposed to the browser; never put secrets there.

---

## Architectural Patterns & Implementation Rules

Padrões estabelecidos durante o desenvolvimento — violações causam bugs silenciosos ou falhas de CI.

### 1. Service Role para Server Actions chamadas de Client Components

**Regra:** Server Actions invocadas de `useEffect`, `useCallback`, ou qualquer hook de ciclo de vida de client components DEVEM usar `getServiceRoleClient()` para queries a dados, NÃO `createServerClient()`.

**Porquê:** O JWT do utilizador não propaga corretamente através de RLS policies com `EXISTS (SELECT FROM profiles...)` quando o contexto assíncrono é iniciado pelo lado do cliente. O service role contorna este problema.

**Requisito obrigatório:** Antes de qualquer `getServiceRoleClient()`, chamar `requireStaffRole()` para verificação de autenticação e papel a nível da aplicação. Nunca service role sem este guard.

**Filtros explícitos:** Como o service role bypassa RLS, todos os queries DEVEM incluir filtros explícitos `club_id` + identificador do recurso para garantir isolamento multi-tenant.

```typescript
// ✅ Correcto
export async function getPlayerData(playerId: string) {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();
  const { data } = await serviceRole
    .from('fatigue_responses')
    .select('...')
    .eq('player_id', playerId)
    .eq('club_id', clubId); // isolamento explícito
}

// ❌ Errado — JWT pode não propagar via useEffect
const supabase = await createServerClient();
const { data } = await supabase.from('fatigue_responses')...
```

Ver `sparta/src/lib/actions/readiness.ts` (`getPlayerDrillDownData`) e `sparta/src/lib/actions/decisions-server.ts` para exemplos canónicos.

---

### 2. Ficheiros "use server" — apenas funções async

**Regra:** Ficheiros com `"use server"` no topo APENAS podem exportar funções async. Qualquer export não-async (schemas Zod, constantes, tipos, objectos) causa **build error em produção**.

**Solução:** Extrair schemas e tipos para `src/lib/schemas/` ou `src/lib/types/`.

```typescript
// ❌ Causa build error
"use server";
export const MySchema = z.object({ ... }); // objecto, não função async

// ✅ Correcto
// src/lib/schemas/my-schema.ts (sem "use server")
export const MySchema = z.object({ ... });

// src/lib/actions/my-action.ts
"use server";
import { MySchema } from "@/lib/schemas/my-schema";
export async function myAction() { ... }
```

---

### 3. RLS Policies — padrão EXISTS/profiles (nunca auth.club_id())

**Regra:** Todas as RLS policies devem usar o padrão `EXISTS (SELECT 1 FROM profiles ...)`. Nunca usar `auth.club_id()`, `auth.jwt()`, ou claims JWT directamente.

**Porquê:** `auth.club_id()` é uma função de JWT hook configurada apenas em produção. O Supabase local (usado em CI) não tem o hook configurado — qualquer migration que use esta função passa em produção mas **falha em CI**. Este é o pior tipo de regressão.

```sql
-- ✅ Correcto — funciona em CI e produção
CREATE POLICY "staff read" ON my_table
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = my_table.club_id
    )
  );

-- ❌ Falha em CI — auth.club_id() não existe em Supabase local
CREATE POLICY "staff read" ON my_table
  FOR SELECT TO authenticated
  USING (club_id = auth.club_id() AND ...);
```

---

### 4. Caminho de Migrations

**Regra:** Todas as migrations DEVEM estar em `sparta/supabase/migrations/`. O directório raiz `supabase/migrations/` (fora de `sparta/`) **não é monitorizado pelo CI**.

**Convenção de naming:** `000NNN_descricao_em_snake_case.sql` — NNN é sequencial com três dígitos (ex: `000260_data_decisions.sql`).

**Função UUID:** Usar sempre `uuidv7()` (definida em migration `000010`). Nunca `uuid_generate_v7()` (não existe no schema do projecto).

```sql
-- ✅ Correcto
id uuid PRIMARY KEY DEFAULT uuidv7()

-- ❌ Falha em CI e produção
id uuid PRIMARY KEY DEFAULT uuid_generate_v7()
```

---

### 5. Readiness Snapshots — Refresh Explícito Obrigatório

**Regra:** `getReadinessPanelData()` lê snapshots existentes do DB — não recalcula. Para obter dados frescos, chamar `refreshUpcomingReadiness(sessionId)` ANTES de `getReadinessPanelData()`.

**Contextos onde o refresh deve ocorrer:**
- Carregamento da página `/prontidao` (server component)
- Botão ↻ no painel (client component `handleManualRefresh`)

```typescript
// ✅ Correcto — recalcula depois lê
await refreshUpcomingReadiness(sessionId);
const result = await getReadinessPanelData(sessionId);

// ❌ Errado — lê snapshots potencialmente stale
const result = await getReadinessPanelData(sessionId);
```

---

### 6. Edge Functions Supabase — Deno.serve() obrigatório

**Regra:** Todas as Supabase Edge Functions DEVEM usar `Deno.serve(handler)` como entrypoint. `export default handler` **nunca é invocado** pelo runtime — o isolate arranca, fica idle, e morre ao fim de 150 s (erros `IDLE_TIMEOUT` / `WORKER_RESOURCE_LIMIT` / HTTP 504 / 546).

**Porquê:** Descoberto em 2026-06-04 após horas de debug. Um handler no-op com `export default` pendura 150 s; o mesmo handler com `Deno.serve()` responde em < 1 s.

**Funções já corrigidas:** `send-push`, `schedule-session-pushes`, `send-parental-consent`.
**Funções ainda por corrigir:** `consent-validate`, `erase-cascade`, `export-csv`, `staff-alert-consent`, `validate-subject-token`, `anonymize-player-photos`, `generate-pdf-report`, `send-rectification-sla`, `send-age-18-reconfirmation`, `auth-hook` — todas usam `export default` e **não funcionam**.

```typescript
// ✅ Correcto
const handler = async (req: Request): Promise<Response> => { ... };
Deno.serve(handler);

// ❌ Nunca invocado — pendura 150 s e morre
export default handler;
```

---

### 7. Edge Functions — web-push: generateRequestDetails + fetch

**Regra:** Usar `webpush.generateRequestDetails()` + `fetch()` nativo. **Nunca** usar `webpush.sendNotification()`.

**Porquê:** `sendNotification()` usa `node:https` internamente, que fica pendurado indefinidamente no runtime Deno do Supabase.

```typescript
// ✅ Correcto — só crypto, sem I/O de rede
const details = await webpush.generateRequestDetails(
  { endpoint: subscription.endpoint, keys: rawKeys },
  JSON.stringify(payload)
);
const response = await fetch(details.endpoint, {
  method: "POST",
  headers: details.headers as Record<string, string>,
  body: details.body ?? undefined,
});

// ❌ Pendura indefinidamente no Deno
await webpush.sendNotification(subscription, payload);
```

---

### 8. notification_log — INSERT requer service role

**Regra:** A tabela `notification_log` só tem policy `SELECT` para `authenticated`. Server actions que inserem em `notification_log` (ex: `sendConvocatoria`) **devem usar `getServiceRoleClient()`** para o insert, depois de verificar autenticação e autorização com o cliente normal.

```typescript
// ✅ Correcto
const { supabase, user, profile } = await getAuthContext(); // verifica auth
// ... validações com supabase ...
const serviceRole = getServiceRoleClient();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await (serviceRole.from as any)("notification_log").upsert(rows, ...);

// ❌ RLS bloqueia — "new row violates row-level security policy"
await supabase.from("notification_log").insert(rows);
```

---

### 9. match_lineups — sem coluna club_id

**Regra:** A tabela `match_lineups` **não tem coluna `club_id`**. O isolamento multi-tenant é feito via `session_id → sessions.club_id` nas RLS policies. Nunca filtrar por `club_id` directamente em `match_lineups`.

**Porquê:** PostgREST devolve erro silencioso para colunas inexistentes quando usado com `as any`, resultando em arrays vazios sem mensagem de erro visível. Foi a causa de `getPlayerNotifications()` não mostrar convocatórias.

```typescript
// ✅ Correcto — isolamento garantido pelo player.id + RLS
await supabase.from("match_lineups")
  .select("id, session_id")
  .eq("player_id", player.id);

// ❌ Falha silenciosamente — coluna não existe
await supabase.from("match_lineups")
  .select("id, session_id")
  .eq("player_id", player.id)
  .eq("club_id", player.club_id); // ← club_id não existe em match_lineups
```

---

### 10. Timezone — sempre Europe/Lisbon em server components

**Regra:** Server components e server actions correm em UTC (Vercel). `format(date, "HH:mm")` do date-fns e `new Date().toLocaleString()` sem timezone mostram hora UTC, não a hora de Portugal (UTC+1 verão / UTC+0 inverno).

**Solução:** Usar `Intl.DateTimeFormat` / `toLocaleTimeString` com `timeZone: "Europe/Lisbon"` explícito. Não instalar `date-fns-tz` — a API nativa é suficiente.

```typescript
const TZ = "Europe/Lisbon";
const date = new Date(session.scheduled_at);

// ✅ Correcto — mostra hora de Portugal
const time = date.toLocaleTimeString("pt-PT", {
  hour: "2-digit", minute: "2-digit", timeZone: TZ, hour12: false,
}); // "11:00"

const dateStr = date.toLocaleDateString("pt-PT", {
  weekday: "long", day: "numeric", month: "long", timeZone: TZ,
}); // "sábado, 6 de junho"

// ❌ Errado em server component — mostra UTC
import { format } from "date-fns";
const time = format(date, "HH:mm"); // "10:00" em vez de "11:00"
```

---

### 11. eslint-disable-next-line com `as any` em objectos multi-linha

**Regra:** O comentário `// eslint-disable-next-line @typescript-eslint/no-explicit-any` suprime apenas a linha **imediatamente seguinte**. Em objectos multi-linha, o `as any` deve estar na mesma linha que o comentário, extraindo o objecto para uma variável separada.

```typescript
// ✅ Correcto — as any está na linha seguinte ao comentário
const patch = { concentration_time: x, opponent_name: y };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await supabase.from("sessions").update(patch as any).eq("id", id);

// ❌ O comentário não cobre a linha onde está o as any (linha 5)
await supabase
  .from("sessions")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .update({
    concentration_time: x,
    opponent_name: y,
  } as any); // ← erro: linha 5, comentário estava na linha 3
```

---

### 12. Pipeline de Push Notifications

O pipeline completo de push notifications:

```text
pg_cron (*/5 min)
  → pg_net.http_post → send-push Edge Function (Deno.serve)
      → supabase-js (service role) → claim_push_notifications() RPC
          → para cada notificação:
              - busca push_subscriptions (is_active=true)
              - webpush.generateRequestDetails() + fetch()
              - actualiza notification_log (sent/failed/skipped)
```

**Tabelas envolvidas:**

- `notification_log` — fila (status: scheduled→processing→sent/failed/skipped)
- `push_subscriptions` — subscrições Web Push por profile_id
- `notification_settings` — pre_minutes, post_minutes, is_enabled por clube

**Kinds suportados:**

- `fatigue_pre` / `fatigue_post` — agendados por `schedule-session-pushes` (horário)
- `player_absence` — inserido por trigger quando jogador declara ausência
- `convocado` — inserido por `sendConvocatoria()` server action

**Regra crítica:** O cron job `send_push_every_5_minutes` foi criado manualmente no Supabase (não via migration) — verificar existência se as notificações pararem.

---

### 13. Inbox de Notificações do Jogador — fontes de dados

O ecrã "Hoje" do jogador combina duas fontes no `getPlayerNotifications()`:

| Tipo        | Fonte                                        | Visível até                 |
|-------------|----------------------------------------------|-----------------------------|
| `convocado` | `match_lineups` (sessões futuras ≤ 14 dias)  | data da sessão ou dismiss   |
| `broadcast` | `broadcasts` (criadas nos últimos 30 dias)   | 30 dias ou dismiss          |

**Dismiss:** `player_inbox_dismissals` (convocado) e `broadcast_dismissals` (broadcast) — RLS: `profile_id = auth.uid()`.

**RLS de match_lineups para jogadores:** A policy `match_lineups_player_own_read` permite ao jogador ler as suas próprias linhas (`player_id = players.id WHERE profile_id = auth.uid()`). Sem esta policy, o inbox de convocatórias fica sempre vazio.
