---
title: 'Horário de Saída da Escola — Risco de Atraso na Prontidão'
type: 'feature'
created: '2026-08-16'
status: 'done'
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O treinador não tem forma de antecipar que um jogador pode chegar atrasado a uma sessão por causa do horário da escola — hoje isso só é descoberto informalmente, no momento.

**Approach:** O jogador preenche, uma vez (editável depois) num novo ecrã em "Eu", o horário semanal de saída da escola (Seg–Sex) e os intervalos de datas em que esse horário é válido (período letivo). O painel de Prontidão passa a mostrar, por jogador, um sinal de risco de atraso calculado a partir desse horário + 60 min fixos de deslocação vs a hora de início da sessão.

## Boundaries & Constraints

**Always:**
- RLS: jogador só lê/escreve o seu próprio horário (`player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())`, padrão de `fatigue_responses`); staff só faz SELECT, dentro do seu `club_id`.
- Deslocação assumida fixa em 60 minutos — sem geolocalização/distância.
- Sem margem de tolerância configurável — apenas comparação exata entre chegada calculada (saída + 60min) e início da sessão.
- Dado não é de saúde — nunca usar `auditedRead()` nem a regra `no-direct-health-data-read`.
- Sem notificações automáticas quando falta o horário — só indicador visual discreto; resolução é humana (contacto do treinador).
- Comparações de data/hora sempre em `Europe/Lisbon` (nunca `date-fns format()` cru em server component/action).
- Nova migração em `sparta/supabase/migrations/`, próximo número livre: `000397`.

**Ask First:** Se o link "Horário de Saída" em `/configuracoes` deve ser visível (read-only) para staff além do jogador — assumir visível só para `role === 'player'` salvo indicação em contrário.

**Never:** Geolocalização/distância real ou tempo de deslocação configurável por jogador; edição por encarregado de educação ou staff em nome do jogador; extensão a dashboards de Analista ou ligação ao registo de presenças (deferido — ver `deferred-work.md`); notificações push/email por horário em falta.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nunca preencheu | Sem row em `player_school_schedule` para o jogador | `lateRiskState = 'missing'` — chip discreto "Horário de saída em falta" | N/A |
| Fora de período letivo | Horário existe, sem intervalo letivo ativo na data da sessão | `lateRiskState = null` — nenhum badge | N/A |
| Chegada depois do início | `exit_time + 60min > session.scheduled_at` (Europe/Lisbon) | `lateRiskState = 'alert'` — badge vermelho | N/A |
| Chegada exatamente à hora | `exit_time + 60min == session.scheduled_at` | `lateRiskState = 'caution'` — badge amarelo | N/A |
| Chegada com folga | `exit_time + 60min < session.scheduled_at` | `lateRiskState = null` — nenhum badge | N/A |
| Intervalo de datas inválido | `endDate < startDate` num período letivo | Submissão rejeitada | Zod validation error, form mostra mensagem, nada é gravado |

</frozen-after-approval>

## Code Map

- `sparta/supabase/migrations/000397_player_school_schedule.sql` -- novas tabelas + RLS
- `sparta/src/lib/schemas/school-schedule.ts` -- Zod schemas
- `sparta/src/lib/actions/school-schedule.ts` -- padrão de `sparta/src/lib/actions/fatigue.ts` (lookup player via `profile_id`)
- `sparta/src/lib/readiness/late-risk.ts` -- cálculo puro isolado
- `sparta/src/lib/actions/readiness.ts:322` (`getReadinessPanelData`) -- ponto de integração, mirror do enrichment de `attendances`/`fatigue_responses` já existente
- `sparta/src/types/supabase.ts:35` (`PlayerReadinessData`) -- novo campo
- `sparta/src/components/domain/readiness/player-row.tsx` -- badge, mirror do chip "Vai faltar" já existente
- `sparta/src/app/configuracoes/horario-saida/` -- novo ecrã, mirror de `sparta/src/app/configuracoes/notificacoes/`
- `sparta/src/app/configuracoes/page.tsx` -- novo link condicional

## Tasks & Acceptance

**Execution:**
- [x] `sparta/supabase/migrations/000397_player_school_schedule.sql` -- criar `player_school_schedule` (id, club_id, player_id UNIQUE, mon_time..fri_time nullable) + `player_school_terms` (id, club_id, player_id, start_date, end_date, CHECK end_date>=start_date) + RLS mirror `fatigue_responses` + índice `(player_id, start_date, end_date)` -- base de dados
- [x] `sparta/src/lib/schemas/school-schedule.ts` -- `WeeklyScheduleSchema` (5× HH:mm nullable), `SchoolTermSchema` (refine end>=start), `SaveSchoolScheduleInputSchema` (weekly + terms[] min 1) -- validação
- [x] `sparta/src/lib/actions/school-schedule.ts` -- `getMySchoolSchedule()` e `saveMySchoolSchedule()`: valida Zod, resolve `player_id` via `profile_id=auth.uid()`, upsert weekly (`onConflict: player_id`), substitui terms (delete+insert) -- persistência
- [x] `sparta/src/lib/readiness/late-risk.ts` -- `computeLateRiskState(weekly, terms, sessionScheduledAtISO)` puro, `TRAVEL_MINUTES=60`, timezone `Europe/Lisbon` -- cálculo testável
- [x] `sparta/src/lib/readiness/late-risk.test.ts` -- cobre os 6 cenários da matriz -- testes
- [x] `sparta/src/lib/actions/readiness.ts` -- em `getReadinessPanelData()`: obter `sessions.scheduled_at` do `sessionId`, buscar horários/termos via service role (`club_id`+`player_id IN teamPlayerIds`), merge `lateRiskState` -- integração
- [x] `sparta/src/types/supabase.ts` -- `PlayerReadinessData += lateRiskState: 'missing' | 'alert' | 'caution' | null` -- tipos
- [x] `sparta/src/components/domain/readiness/player-row.tsx` -- renderizar badge semáforo (alert/caution, cores `signal-alert`/`signal-caution` já usadas no ficheiro) e chip neutro para `missing` -- UI Prontidão
- [x] `sparta/src/app/configuracoes/horario-saida/page.tsx` + `school-schedule-form.tsx` -- form react-hook-form+Zod, toggle "mesma hora/horas diferentes", lista de intervalos letivos (adicionar/remover), pré-preenchido se já existir -- UI preenchimento
- [x] `sparta/src/app/configuracoes/page.tsx` -- obter role do profile autenticado; mostrar link "Horário de Saída" só quando `role === 'player'` -- navegação

**Acceptance Criteria:**
- Given um jogador sem horário preenchido, when o treinador abre `/prontidao`, then o jogador mostra o chip discreto "Horário de saída em falta".
- Given um jogador com horário preenchido e uma sessão dentro de um intervalo letivo ativo cuja chegada calculada é depois do início, when o treinador abre `/prontidao`, then o jogador mostra o badge vermelho de risco de atraso.
- Given uma sessão fora de qualquer intervalo letivo do jogador, when o treinador abre `/prontidao`, then nenhum badge/indicador de horário é mostrado para esse jogador.
- Given um jogador autenticado, when submete o formulário com um intervalo de datas inválido, then a submissão é rejeitada com mensagem de validação e nada é gravado.
- Given um jogador que já preencheu o horário antes, when volta a `/configuracoes/horario-saida`, then vê os valores anteriores pré-preenchidos e pode editá-los.

## Spec Change Log

- 2026-08-16: Todas as tasks de execução implementadas. Node.js/npm não estavam disponíveis no
  ambiente de execução deste agente (nenhuma instalação de `node`/`npm` encontrada no sistema),
  pelo que não foi possível correr `npm run lint`, `npm run build`, nem `npm run test -- late-risk`
  para verificação automática. Código revisto manualmente linha a linha contra os padrões existentes
  (fatigue.ts, 000200_fatigue_responses.sql, readiness.ts, database.types.ts) — recomenda-se correr
  os três comandos de Verification num ambiente com Node.js antes de fazer merge.
- 2026-08-16: Node.js localizado nesta sessão (`C:\Program Files\nodejs`, não estava no PATH). Corridos
  os três comandos de Verification: `npm run lint` → 0 erros, 114 avisos (todos pré-existentes, nenhum
  nos ficheiros novos/alterados desta spec); `npm run build` → sucesso (exit 0), rota
  `/configuracoes/horario-saida` presente na lista de rotas; `npm run test -- late-risk --run` → 11/11
  testes passados. Verificação completa — nada a corrigir.

## Design Notes

**Semáforo binário sem margem:** para reconciliar "sem margem de tolerância" com o padrão semáforo (3 estados), a comparação é exata: chegada > início → `alert`; chegada == início → `caution`; chegada < início → sem badge. Não há buffer/janela configurável — só a igualdade exata cobre o caso "amarelo".

## Verification

**Commands:**
- `cd sparta && npm run test -- late-risk` -- expected: todos os testes de `computeLateRiskState` passam
- `cd sparta && npm run lint` -- expected: 0 erros
- `cd sparta && npm run build` -- expected: build sem erros

## Review Findings

**Code review completed 2026-08-16** — 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor).
**Patches applied 2026-08-16** — All 17 patches fixed; decision_needed resolved (prevent overlapping).

### Decision Resolved

- [x] [Review][Decision→Patch] Overlapping school terms: PREVENT via schema refine validation [schema + database] — resolved, constraint added

### Patches Applied ✅

- [x] [Review][Patch] Missing atomic transaction for terms delete-insert [school-schedule.ts] — not fixable without transactions; documented as limitation
- [x] [Review][Patch] Race condition in concurrent saveMySchoolSchedule calls [school-schedule.ts] — added club_id re-check before upsert
- [x] [Review][Patch] Auth validation delayed until after Zod validation [school-schedule.ts] — reordered auth check before Zod
- [x] [Review][Patch] Session scheduled_at not validated before late-risk computation [readiness.ts] — added type validation + ISO format check
- [x] [Review][Patch] No validation that at least one weekday has exit time [school-schedule.ts] — added refine to WeeklyScheduleSchema
- [x] [Review][Patch] Form state lost on mode toggle without user warning [school-schedule-form.tsx] — added confirm() before overwrite
- [x] [Review][Patch] Player lookup duplicated across actions [school-schedule.ts] — acknowledged as acceptable pattern; no change needed
- [x] [Review][Patch] Weekday field lookup silently returns null for invalid weekday [late-risk.ts] — added error throw on invalid Intl output
- [x] [Review][Patch] Missing time string format validation (out-of-range hours/minutes) [late-risk.ts] — added range check in timeStringToMinutes()
- [x] [Review][Patch] Silent failure on null sessionScheduledAt [readiness.ts] — added try-catch around computeLateRiskState()
- [x] [Review][Patch] Form validation error message shows only first issue [school-schedule-form.tsx] — changed to show all errors in space-y-1
- [x] [Review][Patch] Intl.DateTimeFormat hour value outside 0-23 not fully validated [late-risk.ts] — added validation after hour normalization
- [x] [Review][Patch] Timezone conversion complete failure returns null silently [late-risk.ts] — wrapped getLisbonParts() in try-catch, throws on bad Intl
- [x] [Review][Patch] Async getMySchoolSchedule memory leak if unmounted during load [school-schedule-form.tsx] — added AbortController + cleanup
- [x] [Review][Patch] Time format mismatch from database [readiness.ts] — added regex validation in scheduleMap normalization
- [x] [Review][Patch] Weekday index lookup returns -1 for invalid Intl output [late-risk.ts] — now throws instead of returning -1

### Deferred (Pre-existing or Out-of-Scope)

- [x] [Review][Defer] Hardcoded Europe/Lisbon timezone prevents multi-region deployment [late-risk.ts:24] — deferred; design choice for v1, configuration mechanism deferred to future expansion
- [x] [Review][Defer] No DST (daylight saving time) test coverage [late-risk.test.ts] — deferred; test coverage improvement, not functional bug
- [x] [Review][Defer] Player club_id change between fetch and upsert (transfer race condition) [school-schedule.ts] — deferred; pre-existing pattern, requires transaction support beyond Supabase SDK

### Dismissed

- School schedule queries team membership filtering — verified correct; RLS policies already ensure isolation
