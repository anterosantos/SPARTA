---
title: 'Corrigir "Ocorreu um erro" ao aceder à Agenda como jogador'
type: 'bugfix'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
context: []
---

# Corrigir "Ocorreu um erro" ao aceder à Agenda como jogador

## Intent

**Problem:** `/agenda` mostrava sempre "Ocorreu um erro" a jogadores (confirmado por log de produção: `Error: Erro ao carregar sessões: Acesso restrito a staff.` em `(player)/agenda/page.js`). A mesma falha degradava silenciosamente `/hoje` — a "Próxima sessão" nunca aparecia, sem erro visível. Causa raiz: o commit `4d12e01` (6 jun) reescreveu `getSessionsForClub()` para usar `requireStaffRole()`, que rejeita qualquer role que não seja `coach`/`analyst` — jogadores passaram a receber sempre `{code: "forbidden"}`, e a página `/agenda` propaga esse erro com `throw new Error(...)`, disparado pelo `ErrorBoundary` genérico.

**Approach:** `getSessionsForClub()` passa a resolver o `clubId`/`teamIds` por ramo de role: `coach`/`analyst` continua a usar `requireStaffRole()` (comportamento inalterado, filtro pelas equipas do staff via `team_coaches`); `player` passa a resolver o seu próprio registo em `players` (por `profile_id` + `club_id`) e as suas equipas via `team_players` (`is_archived = false`), reutilizando o mesmo padrão já usado em `getPlayerIdsForTeams()`. O resto da função (query por `club_id` + filtros, depois filtro por `session_teams`: sessões sem equipas atribuídas ficam visíveis a todos) fica inalterado — opera de forma genérica sobre o `clubId`/`teamIds` resolvido. Outras roles (ex.: `admin`) continuam a receber `forbidden`, tal como antes desta correção.

## Suggested Review Order

- Root cause e fix — resolução de `clubId`/`teamIds` por role em vez de exigir sempre staff.
  [`sessions.ts:43`](../../sparta/src/lib/actions/sessions.ts#L43)

- Testes de regressão — cobrem sucesso para role `player`, erro `forbidden` para role desconhecida (ex.: `admin`), e o filtro real por equipa do jogador (sessão da sua equipa e sessão sem equipas visíveis; sessão de outra equipa oculta).
  [`sessions.test.ts:122`](../../sparta/src/__tests__/lib/actions/sessions.test.ts#L122)

- Cobertura de página nova (`/agenda` nunca tinha testes) — confirma que não lança erro para jogador com sessões e mostra o `EmptyState` correto sem sessões.
  [`agenda.test.tsx`](../../sparta/src/__tests__/app/agenda.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/lib/actions/sessions.test.ts src/__tests__/app/agenda.test.tsx src/__tests__/app/hoje.test.tsx src/__tests__/app/calendario.test.tsx src/__tests__/app/sessoes.test.tsx` -- expected: 43 testes a passar
- `cd sparta && npx vitest run` -- expected: suite completa passa (2055 testes; 1 falha pré-existente em `admin-schema.integration.test.ts` por falta de Supabase local, não relacionada)
- Revisão adversarial (subagent independente): sem bugs exploráveis encontrados — isolamento multi-tenant do lookup de `players` confirmado (filtrado por `profile_id` + `club_id`), comportamento de staff inalterado, falha fechada (erro, não dados errados) se o jogador não tiver registo em `players`.
