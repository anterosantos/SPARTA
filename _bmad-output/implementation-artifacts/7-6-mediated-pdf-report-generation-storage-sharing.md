# Story 7.6: Relatório PDF Mediado — Geração, Armazenamento & Partilha

**Status:** done

**Story ID:** 7.6
**Epic:** Epic 7 — Análise Avançada & Operacionalização "Dados Mediados" (Phase 2 / Growth)
**Criado:** 2026-06-01
**Story anterior:** 7-5-fatigue-performance-correlation-detection (done)

---

## ⚠️ DEPENDÊNCIAS CRÍTICAS

> **BLOQUEADORES**: As seguintes histórias DEVEM estar em estado `done` antes de iniciar a implementação:
>
> - **Story 1.3** — `uuidv7()` definida em migration `000010`
> - **Story 1.12** — `audit_logs` + `auditedRead()` wrapper
> - **Story 2.1** — tabela `players` com `full_name`, `club_id`, `profile_id`
> - **Story 3.9** — `checkProcessingRestricted(playerId)` em `data-rights.ts`
> - **Story 4.6** — `proxy.ts` com `/plantel` em `STAFF_ONLY_ROUTES_404` (já cobre `/plantel/[id]/relatorio` e `/plantel/[id]/relatorios`)
> - **Story 7.2** — `/plantel/[id]/perfil` + `PlayerProfileHeader.tsx` + estrutura de rotas `[id]`

---

## Especificação da História

### User Story

Como Treinador ou Analista,
Quero gerar um relatório PDF para um jogador específico (com a sua performance e fadiga) e partilhá-lo via link assinado,
Para que o staff cuide do que é transmitido (filosofia "dados mediados") sem dar ao jogador ou encarregado acesso self-service ao sistema.

### Acceptance Criteria

#### AC #1 — Migração SQL `000310_pdf_reports.sql`

**Given** migration `000310_pdf_reports.sql`
**When** aplicada
**Then** tabela `pdf_reports` existe:
- `id uuid PK DEFAULT uuidv7()`
- `club_id uuid NOT NULL FK clubs(id) ON DELETE CASCADE`
- `player_id uuid NOT NULL FK players(id) ON DELETE CASCADE`
- `generated_by uuid NOT NULL FK profiles(id) ON DELETE SET NULL`
- `scope text NOT NULL CHECK (scope IN ('match', 'training', 'period'))`
- `period_start date NOT NULL`
- `period_end date NOT NULL`
- `file_path text NOT NULL`
- `generated_at timestamptz NOT NULL DEFAULT now()`
- `shared_with_email citext` (nullable)
- `shared_at timestamptz` (nullable)
- `expires_at timestamptz NOT NULL`

**And** RLS habilitado com isolamento por clube + escrita apenas para staff (FR59):
- SELECT: staff do mesmo clube
- INSERT: staff do mesmo clube
- UPDATE: staff do mesmo clube (para partilha e revogação)
- DELETE: nenhum (registos imutáveis; revogar = `expires_at = now()`)

#### AC #2 — Edge Function `generate-pdf-report`

**Given** rota `/plantel/[id]/relatorio/novo`
**When** o staff (coach ou analyst) configura o relatório (período início/fim, scope, email opcional)
**Then** Server Action `generateReport()` chama a Edge Function `generate-pdf-report`
**And** a Edge Function usa `pdfmake` para renderizar um PDF estruturado com:
  - Cabeçalho do jogador (nome, posição, escalão)
  - Série de fadiga no período
  - ACWR ao longo do período
  - Totais de sRPE
  - Breakdown de estatísticas por jogo (match events)
  - Resumo de presenças

**And** o ficheiro é carregado para o bucket `reports` do Supabase Storage com path `{club_id}/{player_id}/{timestamp}-{scope}.pdf`
**And** URL assinada com 30 dias (`expires_in: 2592000`) é criada
**And** row inserida em `pdf_reports` com `expires_at = now() + interval '30 days'`

#### AC #3 — Audit Logging (FR50)

**Given** a Edge Function gera o relatório com sucesso
**When** o relatório é gerado
**Then** entrada em `audit_logs`: `action='report.generated'`, `target_kind='player'`, `target_id=player_id`, `payload={generated_by, scope, period_start, period_end}`

#### AC #4 — Partilha Mediada por Email

**Given** o staff introduz um email e confirma a partilha
**When** `shareReport(reportId, email)` é chamada
**Then** email enviado via Brevo API (`https://api.brevo.com/v3/smtp/email`) com URL assinada e copy B1 PT-PT:
  - Assunto: `"Relatório de {playerName} — SPARTA"`
  - Corpo: `"Em anexo, o relatório de {playerName}. Disponível durante 30 dias."`
**And** `shared_with_email` e `shared_at` actualizados em `pdf_reports`
**And** entrada em `audit_logs`: `action='report.shared'`, `target_kind='player'`, `target_id=player_id`, `payload={shared_with_email}`

#### AC #5 — Bloqueio de Self-Access do Jogador (FR26, FR59)

**Given** o jogador NÃO tem caminho directo para gerar ou listar relatórios
**When** um Jogador tenta `/plantel/[id]/relatorio/novo` com o seu próprio id
**Then** o middleware retorna 404 (já coberto por `/plantel` em `STAFF_ONLY_ROUTES_404`)
**And** as Server Actions `generateReport()` e `getPlayerReports()` verificam `requireStaffRole()` e rejeitam com `{code: 'forbidden'}` se não for staff

#### AC #6 — Restrição de Processamento (Story 3.9)

**Given** o jogador afectado tem `processing_restricted = true`
**When** `generateReport()` é chamada para esse jogador
**Then** retorna `{ok: false, error: 'processing_restricted'}` com mensagem clara para o staff
**And** nenhum PDF é gerado, nenhuma linha inserida em `pdf_reports`

#### AC #7 — Vista de Histórico `/plantel/[id]/relatorios`

**Given** a rota `/plantel/[id]/relatorios`
**When** aberta pelo staff
**Then** lista de relatórios passados com: scope, período, data de geração, `shared_with_email` ou "(não partilhado)", estado do link (activo / expirado)
**And** cada linha tem botões "Reenviar link" e "Revogar link"
**When** "Revogar link" é confirmado
**Then** o ficheiro é eliminado do Storage + `expires_at = now()` em `pdf_reports`
**And** entrada em `audit_logs`: `action='report.revoked'`, `target_kind='player'`, `target_id=player_id`

#### AC #8 — Cobertura de Testes (NFR54)

**Given** testes em `src/lib/actions/__tests__/reports.test.ts`
**When** executados
**Then** cobrem ≥ 80%:
- Geração rejeitada quando `processing_restricted=true`
- Geração rejeitada quando não staff (`requireStaffRole` falha)
- `getPlayerReports()` retorna lista isolada por clube
- `revokeReport()` marca `expires_at=now()` (sem deleção de linha DB)
- Audit logging em geração, partilha, revogação

---

## Contexto para o Desenvolvedor

### ⚠️ CORREÇÃO CRÍTICA — Email: Brevo (NÃO Resend)

> **ATENÇÃO:** O epics.md menciona "Resend EU" para o envio de email (AC #4). Este é um erro — a Story 1.18 migrou toda a infra de email para **Brevo**. Usar SEMPRE a Brevo API:
> ```
> POST https://api.brevo.com/v3/smtp/email
> Header: api-key: {BREVO_API_KEY}
> ```
> Variáveis de ambiente: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`
> Ver `supabase/functions/export-csv/index.ts` e `send-age-18-reconfirmation/index.ts` para o padrão correcto.

### ⚠️ PDF Library — `pdfmake` via esm.sh

> **NÃO instalar `@react-pdf/renderer` nem qualquer dependência PDF no package.json.** O PDF é gerado na **Edge Function Deno**, não no Next.js. Usar `pdfmake` via esm.sh no `deno.json` da Edge Function:
> ```json
> {
>   "imports": {
>     "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.46.0",
>     "pdfmake": "https://esm.sh/pdfmake@0.2.15",
>     "pdfmake/build/vfs_fonts": "https://esm.sh/pdfmake@0.2.15/build/vfs_fonts"
>   }
> }
> ```
> `pdfmake` é puro JavaScript, não requer React, funciona perfeitamente em Deno/Edge Functions.

### ⚠️ Bucket `reports` — Criação Manual

> O bucket `reports` NÃO existe ainda no Supabase Storage. Requer criação **manual** no Supabase Console + políticas RLS no SQL Editor.
> **Instruções a incluir na história e no código:**
> ```
> Supabase Console > Storage > New Bucket
> Name: reports
> Private: YES
> ```
> Path pattern: `{club_id}/{player_id}/{timestamp}-{scope}.pdf`
> RLS policies: staff do mesmo clube pode SELECT/INSERT/DELETE (para revogar)

### Estrutura de Ficheiros

```
sparta/
  supabase/
    migrations/
      000310_pdf_reports.sql               ← NOVO

  supabase/functions/
    generate-pdf-report/
      index.ts                             ← NOVO: Edge Function principal
      deno.json                            ← NOVO: imports pdfmake + supabase-js

  src/
    lib/
      actions/
        reports.ts                         ← NOVO: Server Actions
        __tests__/
          reports.test.ts                  ← NOVO: testes ≥ 80%

    app/(staff)/
      plantel/[id]/
        relatorio/
          novo/
            page.tsx                       ← NOVO: Server Component (wrapper)
            RelatorioPdfForm.tsx           ← NOVO: Client Component (form + botão)
        relatorios/
          page.tsx                         ← NOVO: Server Component (lista histórico)
          RelatorioRow.tsx                 ← NOVO: Client Component (linha + acções)
```

> **Nota:** Nenhuma alteração a `proxy.ts` necessária — `/plantel` já bloqueia jogadores em `STAFF_ONLY_ROUTES_404`. A rota `/relatorio/novo` (singular) é NÃO listada em proxy; está coberta por `/plantel`. A rota `/relatorios` (plural) JÁ EXISTE em `STAFF_ONLY_ROUTES_404`.

---

## 1. Migração SQL `000310_pdf_reports.sql`

```sql
-- Migration: 000310_pdf_reports
-- Purpose: Armazenar metadados de relatórios PDF gerados e partilhados (FR59)
-- Dependencies: uuidv7() (1.3), profiles (1.3), players (2.1), clubs (1.3)

CREATE TABLE public.pdf_reports (
  id               uuid        PRIMARY KEY DEFAULT public.uuidv7(),
  club_id          uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id        uuid        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  generated_by     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  scope            text        NOT NULL CHECK (scope IN ('match', 'training', 'period')),
  period_start     date        NOT NULL,
  period_end       date        NOT NULL,
  file_path        text        NOT NULL,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  shared_with_email citext,
  shared_at        timestamptz,
  expires_at       timestamptz NOT NULL,
  CONSTRAINT period_start_before_end CHECK (period_start <= period_end)
);

CREATE INDEX idx_pdf_reports_club ON public.pdf_reports(club_id);
CREATE INDEX idx_pdf_reports_player ON public.pdf_reports(player_id);

ALTER TABLE public.pdf_reports ENABLE ROW LEVEL SECURITY;

-- Staff do mesmo clube pode ler
CREATE POLICY "pdf_reports_staff_read"
  ON public.pdf_reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = pdf_reports.club_id
    )
  );

-- Staff do mesmo clube pode inserir
CREATE POLICY "pdf_reports_staff_insert"
  ON public.pdf_reports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = pdf_reports.club_id
    )
  );

-- Staff do mesmo clube pode actualizar (partilha, revogação)
CREATE POLICY "pdf_reports_staff_update"
  ON public.pdf_reports FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = pdf_reports.club_id
    )
  );
```

> **REGRA RLS:** Usar sempre `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() ...)`. Nunca `auth.club_id()` — não existe em Supabase local/CI e causa falhas silenciosas.

---

## 2. Edge Function `generate-pdf-report`

### `supabase/functions/generate-pdf-report/deno.json`

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.46.0",
    "pdfmake/": "https://esm.sh/pdfmake@0.2.15/"
  }
}
```

### `supabase/functions/generate-pdf-report/index.ts`

Padrão do `export-csv/index.ts` (NÃO o estilo `@ts-nocheck` do `send-age-18-reconfirmation`):

```typescript
declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

import { createClient } from '@supabase/supabase-js'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

pdfMake.vfs = pdfFonts.vfs

const UUID_PATTERN = /^[0-9a-f-]{36}$/i
const SIGNED_URL_SECONDS = 2592000 // 30 dias
```

**Estrutura do handler:**
1. Validar `{playerId, clubId, generatedBy, scope, periodStart, periodEnd, sharedEmail?}` do body
2. Verificar `processing_restricted` no player/profile
3. Buscar dados do período: fatigue_responses, session_metrics, match_events, attendances
4. Criar `TDocumentDefinitions` pdfmake com as secções do relatório
5. `pdfMake.createPdf(docDef).getBuffer(callback)` para gerar bytes
6. Upload para `reports` bucket: `supabase.storage.from('reports').upload(path, buffer, {contentType: 'application/pdf'})`
7. `supabase.storage.from('reports').createSignedUrl(path, SIGNED_URL_SECONDS)`
8. Insert em `pdf_reports`
9. Insert em `audit_logs` (`action='report.generated'`)
10. Se `sharedEmail`: enviar via Brevo, actualizar `shared_with_email`/`shared_at`, audit `report.shared`
11. Retornar `{ok: true, reportId, signedUrl}`

**CORS headers obrigatórios** (mesmo padrão do export-csv):
```typescript
const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000'
const corsHeaders = {
  'Access-Control-Allow-Origin': appUrl,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

**Entry point Deno** (manter no final, mesmo padrão export-csv):
```typescript
if (typeof (globalThis as any).Deno !== 'undefined') {
  Deno.serve(handler)
}
```

---

## 3. Server Actions `src/lib/actions/reports.ts`

```typescript
"use server";

import { requireStaffRole } from "@/lib/actions/auth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { checkProcessingRestricted } from "@/lib/actions/data-rights";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

export type ReportScope = 'match' | 'training' | 'period';

export interface PdfReport {
  id: string;
  scope: ReportScope;
  period_start: string;
  period_end: string;
  generated_at: string;
  shared_with_email: string | null;
  shared_at: string | null;
  expires_at: string;
  file_path: string;
}
```

**`generateReport(playerId, {scope, periodStart, periodEnd, sharedEmail?})`:**
1. `requireStaffRole()` — retornar err se falhar
2. `checkProcessingRestricted(playerId)` — retornar `err({code:'processing_restricted', ...})` se verdadeiro
3. `getServiceRoleClient()` para verificar que o player pertence ao mesmo clube
4. Invocar Edge Function via `supabase.functions.invoke('generate-pdf-report', {body: {...}})`
5. Retornar `{ok: true, reportId, signedUrl}` ou `err`

**`getPlayerReports(playerId)`:**
1. `requireStaffRole()` — verificar clubId
2. `getServiceRoleClient().from('pdf_reports').select(...).eq('player_id', playerId).eq('club_id', clubId).order('generated_at', {ascending: false})`
3. Retornar lista

**`revokeReport(reportId)`:**
1. `requireStaffRole()`
2. Buscar report do mesmo clube (verificar isolamento)
3. `supabase.storage.from('reports').remove([report.file_path])`
4. `.update({expires_at: new Date().toISOString()}).eq('id', reportId)`
5. Insert audit_log `action='report.revoked'`

**`shareReport(reportId, email)`:**
1. `requireStaffRole()`
2. Buscar report, gerar nova signed URL se expirada ou reenviar a existente
3. Enviar via Brevo (fetch directo — Server Action pode fazer fetch externo)
4. `.update({shared_with_email: email, shared_at: now}).eq('id', reportId)`
5. Insert audit_log `action='report.shared'`

> **CRÍTICO — PADRÃO SERVICE ROLE:** Server Actions invocadas de Client Components DEVEM usar `getServiceRoleClient()` com `requireStaffRole()` primeiro. Ver AGENTS.md Regra #1. `supabase.functions.invoke()` também requer o service role client para ter permissões de invocar.

---

## 4. Página `/plantel/[id]/relatorio/novo`

### `page.tsx` — Server Component

```tsx
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { RelatorioPdfForm } from "./RelatorioPdfForm";

export default async function NovoRelatorioPage({ params }: { params: { id: string } }) {
  const auth = await requireStaffRole();
  if (!auth.ok) redirect("/login");
  return (
    <main className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">Gerar Relatório PDF</h1>
      <RelatorioPdfForm playerId={params.id} />
    </main>
  );
}
```

### `RelatorioPdfForm.tsx` — Client Component

- `"use client"` no topo
- Formulário com `react-hook-form` + Zod:
  - `scope`: Select (`match`/`training`/`period`) — label PT-PT: "Âmbito"
  - `periodStart`: date input — label "Início do período"
  - `periodEnd`: date input — label "Fim do período"
  - `sharedEmail`: email input opcional — label "Partilhar por email (opcional)"
- Botão "Gerar relatório" — chama `generateReport(playerId, {...})`
- Em sucesso: mostrar link para download + `<CalmConfirmation>` "Relatório gerado com sucesso."
- Em erro `processing_restricted`: mostrar mensagem "Não é possível gerar relatório — processamento restringido por pedido GDPR."
- Loading state durante geração (pode demorar 5-15s)

---

## 5. Página `/plantel/[id]/relatorios`

### `page.tsx` — Server Component

```tsx
import { getPlayerReports } from "@/lib/actions/reports";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { RelatorioRow } from "./RelatorioRow";

export default async function RelatoriosPage({ params }: { params: { id: string } }) {
  const auth = await requireStaffRole();
  if (!auth.ok) redirect("/login");
  const result = await getPlayerReports(params.id);
  const reports = result.ok ? result.data : [];
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Relatórios</h1>
      {reports.length === 0 ? (
        <EmptyState message="Ainda não foram gerados relatórios para este jogador." />
      ) : (
        <ul>
          {reports.map(r => <RelatorioRow key={r.id} report={r} />)}
        </ul>
      )}
    </main>
  );
}
```

### `RelatorioRow.tsx` — Client Component

- Mostrar: scope, período (formatado PT-PT), data geração, email partilhado ou "(não partilhado)", badge "Activo"/"Expirado" (comparar `expires_at` com `Date.now()`)
- Botão "Reenviar link" → `shareReport(reportId, email)` — modal para email se não havia anteriormente
- Botão "Revogar link" → `revokeReport(reportId)` — dialog de confirmação com `<CalmConfirmation>`

---

## Notas de Desenvolvimento

### Restrições e Padrões Obrigatórios

1. **`generated_by` na migration usa `ON DELETE SET NULL`** — diferente de `CASCADE` porque o relatório deve persistir mesmo que o staff que o gerou seja removido.

2. **Signed URL de 30 dias** = `2592000` segundos. Verificar: o `createSignedUrl` da Supabase Storage aceita expiração em segundos.

3. **Storage path**: `{club_id}/{player_id}/{Date.now()}-{scope}.pdf` — inclui `club_id` no prefixo para isolamento por clube nas políticas de Storage.

4. **`pdfmake` em Deno**: A API é callback-based: `pdfMake.createPdf(docDef).getBuffer((buffer) => { ... })`. Para async/await, envolver num `new Promise<Uint8Array>((resolve, reject) => pdfMake.createPdf(docDef).getBuffer(resolve))`.

5. **Tamanho do PDF**: O relatório pode ser grande (muitos match events). Implementar timeout de 30s para a geração (mesmo padrão do ZIP no export-csv).

6. **Fonts pdfmake**: O `vfs_fonts` inclui Roboto por omissão — suficiente para PT-PT.

7. **Brevo email na Edge Function** (se `sharedEmail` presente): usar o mesmo padrão fire-and-forget do export-csv — enviar sem bloquear a resposta principal.

8. **`checkProcessingRestricted` localização**: `src/lib/actions/data-rights.ts` linha ~1111. Importar de `@/lib/actions/data-rights`.

9. **Bucket `reports` NÃO existe** — documentar no PR que requer criação manual no Supabase Console antes do deploy. Incluir comentário no topo da migração.

10. **`functions.invoke()` no cliente service role**: Usar `getServiceRoleClient().functions.invoke('generate-pdf-report', ...)` — o client service role tem permissão para invocar Edge Functions autenticadas.

### Aprendizagens da Story 7.5 (código de correlações)

- **Importações de `@/lib/types`**: `ok`, `err`, `Result`, `AppError` são sempre importados do mesmo lugar
- **`noUncheckedIndexedAccess`**: Todos os acessos a array/object devem usar `?.` + `?? fallback` — ver AGENTS.md
- **ESLint `custom/no-direct-health-data-read`**: `fatigue_responses` requer o disable comment quando acedido directamente (dentro de auditedRead está OK)

### Aprendizagens de Stories de Edge Functions (3.6, 4.8)

- **CORS OPTIONS obrigatório**: `if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })`
- **Validação do body obrigatória**: Sempre `try/catch` no `req.json()`
- **UUID validation**: Usar `UUID_PATTERN = /^[0-9a-f-]{36}$/i` para todos os IDs recebidos
- **Service role no EF**: Nunca usar a anon key na Edge Function — sempre `SUPABASE_SERVICE_ROLE_KEY`
- **`Deno.serve(handler)` apenas em runtime Deno**: Guard com `if (typeof (globalThis as any).Deno !== 'undefined')`

### Testes

```typescript
// src/lib/actions/__tests__/reports.test.ts

// Mock requireStaffRole → retornar { ok: true, data: { userId, clubId, role } }
// Mock getServiceRoleClient → retornar supabase mock
// Mock checkProcessingRestricted → controlar em cada teste

describe('generateReport', () => {
  it('rejeita quando processing_restricted=true')
  it('rejeita quando não é staff (forbidden)')
  it('rejeita quando player não pertence ao clube')
  it('invoca Edge Function com params correctos')
})

describe('getPlayerReports', () => {
  it('retorna lista filtrada por player_id + club_id')
  it('retorna [] quando não há relatórios')
  it('rejeita quando não é staff')
})

describe('revokeReport', () => {
  it('actualiza expires_at para now()')
  it('remove ficheiro do Storage')
  it('cria audit log report.revoked')
  it('rejeita quando report não pertence ao clube')
})
```

> **Padrão de mock das actions**: Ver `src/lib/actions/__tests__/` nos ficheiros existentes (`reports.test.ts` de stories anteriores como `team-aggregate.test.ts`) para padrões de vi.mock + vi.fn.

### Ficheiros a NÃO modificar

- `src/proxy.ts` — `/plantel` já bloqueia jogadores; `/relatorios` já está em `STAFF_ONLY_ROUTES_404`
- `src/app/(staff)/plantel/[id]/perfil/ProfileTabs.tsx` — relatório não é um tab do perfil; é rota separada
- Qualquer migration existente

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Migração `000310_pdf_reports.sql` criada com tabela, índices e políticas RLS (staff do mesmo clube: SELECT/INSERT/UPDATE; sem DELETE — revogar = `expires_at = now()`).
- Edge Function `generate-pdf-report` criada com `pdfmake` via esm.sh/Deno, CORS, validação de inputs, PDF gerado com fadiga/sRPE/match events/presenças, upload para bucket `reports`, signed URL 30 dias, audit log `report.generated`, email Brevo fire-and-forget.
- Server Actions `reports.ts`: `generateReport` (verifica staff + processing_restricted + club_id), `getPlayerReports` (isolamento por clube), `revokeReport` (remove Storage + expires_at + audit), `shareReport` (Brevo + audit).
- Páginas `/plantel/[id]/relatorio/novo` (Server Component + `RelatorioPdfForm` Client Component com react-hook-form/Zod) e `/plantel/[id]/relatorios` (Server Component + `RelatorioRow` Client Component com badges Activo/Expirado, reenviar/revogar).
- `database.types.ts` actualizado com tabela `pdf_reports` (Row/Insert/Update/Relationships).
- 13/13 testes passam; 1944/1944 testes na suite completa ✅; lint 0 erros ✅; typecheck sem novos erros ✅.
- Bucket `reports` requer criação manual no Supabase Console (Private: YES) antes do deploy — documentado no topo da migração.

### File List

- `sparta/supabase/migrations/000310_pdf_reports.sql`
- `sparta/supabase/functions/generate-pdf-report/deno.json`
- `sparta/supabase/functions/generate-pdf-report/index.ts`
- `sparta/src/lib/actions/reports.ts`
- `sparta/src/lib/actions/__tests__/reports.test.ts`
- `sparta/src/lib/supabase/database.types.ts`
- `sparta/src/app/(staff)/plantel/[id]/relatorio/novo/page.tsx`
- `sparta/src/app/(staff)/plantel/[id]/relatorio/novo/RelatorioPdfForm.tsx`
- `sparta/src/app/(staff)/plantel/[id]/relatorios/page.tsx`
- `sparta/src/app/(staff)/plantel/[id]/relatorios/RelatorioRow.tsx`

### Review Findings

- [x] `Review/Patch` P-1: `generated_by` NOT NULL contradicts ON DELETE SET NULL — remover NOT NULL da coluna `generated_by` `000310_pdf_reports.sql:14`
- [x] `Review/Patch` P-2: UPDATE RLS policy sem WITH CHECK — campo `club_id`/`player_id` pode ser alterado por qualquer staff do clube `000310_pdf_reports.sql`
- [x] `Review/Patch` P-3: Secção ACWR em falta no PDF gerado — AC #2 exige "ACWR ao longo do período"; Edge Function não calcula nem inclui ACWR `generate-pdf-report/index.ts:buildPdfDoc`
- [x] `Review/Patch` P-4: Usar `supabase.functions.invoke()` em vez de raw fetch com service role key — spec AGENTS.md Regra #1 e nota 10 `reports.ts:generateReport`
- [x] `Review/Patch` P-5: `periodStart`/`periodEnd` sem validação de formato de data ISO — inputs malformados passam silenciosamente `generate-pdf-report/index.ts:validação`
- [x] `Review/Patch` P-6: Fire-and-forget da Edge Function actualiza `shared_with_email` mesmo quando Brevo falha `generate-pdf-report/index.ts:409-464`
- [x] `Review/Patch` P-7: `shareReport` cria nova signed URL mas não actualiza `expires_at` quando relatório não está expirado `reports.ts:shareReport`
- [x] `Review/Patch` P-8: `revokeReport` continua em caso de falha na remoção do ficheiro do Storage — link assinado existente mantém-se válido `reports.ts:revokeReport:168-175`
- [x] `Review/Patch` P-9: `getPlayerReports` sem validação de `playerId` (string vazia passaria o filtro) `reports.ts:getPlayerReports`
- [x] `Review/Patch` P-10: UUID_PATTERN aceita strings malformadas (36 chars com apenas dashes) — usar regex canónico `generate-pdf-report/index.ts:14`
- [x] `Review/Patch` P-11: `revokeReport` sem guarda contra dupla revogação — cria audit log duplicado `reports.ts:revokeReport`
- [x] `Review/Patch` P-12: `signedUrl` renderizado sem validação de origem — adicionar guard de URL antes de render `RelatorioPdfForm.tsx:164-170`
- [x] `Review/Patch` P-13: Teste `getPlayerReports` não verifica que filtro `club_id` é aplicado explicitamente — AC #8 `reports.test.ts`
- [x] `Review/Defer` D-1: `generatedBy` caller-supplied na Edge Function — acceptable porque só acessível via service role key server-side `generate-pdf-report/index.ts` — deferred, pre-existing
- [x] `Review/Defer` D-2: Email enviado antes de update à DB em `shareReport` — problema de ordenação distribuída; padrão consistente com o projecto `reports.ts:shareReport` — deferred, pre-existing
- [x] `Review/Defer` D-3: `isActive()` calculado em tempo de render — stale em sessões longas; server actions validam estado server-side `RelatorioRow.tsx` — deferred, pre-existing
- [x] `Review/Defer` D-4: UI permite re-partilhar ilimitadamente — sem spec limit, server não bloqueia `RelatorioRow.tsx` — deferred, pre-existing

## Change Log

- 2026-06-02: Story 7-6 code-review complete; 13 patches aplicados (NOT NULL migration, WITH CHECK RLS, ACWR secção PDF, functions.invoke, date validation, Brevo fire-and-forget, expires_at, storage error, playerId guard, UUID regex, double-revoke guard, URL validation, club_id test); 1944/1944 testes ✅; lint ✅
- 2026-06-02: Story 7-6 implementada — migração pdf_reports, Edge Function generate-pdf-report (pdfmake/Deno), Server Actions (generateReport/getPlayerReports/revokeReport/shareReport), páginas /relatorio/novo + /relatorios, database.types.ts actualizado, 13 novos testes; 1944/1944 testes ✅; lint ✅; typecheck ✅
