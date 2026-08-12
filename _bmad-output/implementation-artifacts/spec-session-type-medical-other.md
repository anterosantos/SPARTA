---
title: 'Novos tipos de sessão: Médico/Fisio e Outros (sem questionário de fadiga)'
type: 'feature'
created: '2026-08-12'
status: 'done'
route: 'plan-code-review'
context: []
---

# Novos tipos de sessão: Médico/Fisio e Outros (sem questionário de fadiga)

## Intent

**Problem:** A lista de tipos de sessão tinha Jogo, Jogo Amigável, Treino e Palestra. Pedido para acrescentar "Médico/Fisio" e "Outros" — tal como Palestra, nenhum dos dois gera questionário de fadiga.

**Approach:** `SESSION_TYPES` em `schemas/sessions.ts` passou a incluir `medical`/`other`. Como `requiresFatigueQuestionnaire()` já era uma allowlist (training/match/friendly), os dois tipos novos ficam automaticamente sem questionário — nenhuma alteração adicional necessária nesse guard nem nos três pontos que o usam (SessionCard, página do questionário, push de fadiga). O compilador (`Record<SessionType, ...>` exaustivos) apanhou os 4 sítios com mapeamentos obrigatórios a completar (cores, ícones × 2, tipo do FatigueQuestionnaire); os restantes sítios com listas manuais (labels de formulário, filtros de "Treinos" vs "Jogos", redirect da convocatória) foram encontrados por grep a `lecture` e atualizados manualmente, já que não são listas exaustivas verificadas em tempo de compilação.

**Nota sobre convocatória:** o redirect em `convocatoria/page.tsx` passou de denylist (`type === "training" || type === "lecture"`) para allowlist (`type !== "match" && type !== "friendly"`) — mais robusto a futuros tipos. O enforcement server-side em `lineups.ts` já era allowlist (`["match","friendly"]`) e não precisou de alteração.

## Suggested Review Order

- Fonte única de verdade — novo array de tipos.
  [`schemas/sessions.ts:3`](../../sparta/src/lib/schemas/sessions.ts#L3)
- Migração da base de dados (CHECK constraint).
  [`000396_sessions_medical_other_types.sql`](../../sparta/supabase/migrations/000396_sessions_medical_other_types.sql)
- Cores/ícones (apanhados pelo compilador — `Record<SessionType,...>` exaustivo).
  [`session-colors.ts`](../../sparta/src/lib/constants/session-colors.ts), [`session-card.tsx`](../../sparta/src/components/ui/session-card.tsx), [`sessoes/[id]/page.tsx`](../../sparta/src/app/(staff)/sessoes/[id]/page.tsx)
- Formulário de sessão — novas opções no dropdown (sem alterar a regra de 1-equipa-só-para-jogo, que não se aplica aos novos tipos).
  [`session-form.tsx`](../../sparta/src/app/(staff)/calendario/session-form.tsx)
- Filtros "Treinos"/"Jogos" (presenças do jogador, lista de sessões) — Médico/Fisio e Outros juntam-se ao grupo "não-jogo".
  [`PresencasTab.tsx`](../../sparta/src/app/(staff)/plantel/[id]/perfil/PresencasTab.tsx), [`sessoes/page.tsx`](../../sparta/src/app/(staff)/sessoes/page.tsx)
- Convocatória — redirect invertido para allowlist.
  [`convocatoria/page.tsx:60`](../../sparta/src/app/(staff)/sessoes/[id]/convocatoria/page.tsx#L60)
- Testes: `requiresFatigueQuestionnaire`, SessionCard, guard da página do questionário, MonthGrid.
  [`sessions.test.ts`](../../sparta/src/__tests__/lib/schemas/sessions.test.ts), [`session-card.test.tsx`](../../sparta/src/__tests__/components/session-card.test.tsx), [`questionario page.test.tsx`](../../sparta/src/app/(player)/questionario/[sessionId]/[phase]/__tests__/page.test.tsx), [`month-grid.test.tsx`](../../sparta/src/components/ui/month-grid.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/lib/schemas/sessions.test.ts src/components/ui/__tests__/session-card.test.tsx src/__tests__/components/session-card.test.tsx src/components/domain/FatigueTable.test.tsx src/__tests__/components/session-form.test.tsx src/components/ui/month-grid.test.tsx "src/app/(player)/questionario/[sessionId]/[phase]/__tests__/page.test.tsx" src/__tests__/app/convocatoria.test.tsx src/__tests__/app/sessoes.test.tsx src/__tests__/app/calendario.test.tsx src/__tests__/app/agenda.test.tsx src/__tests__/app/hoje.test.tsx` -- expected: 148 testes a passar
- `cd sparta && npx tsc --noEmit` -- expected: sem novos erros (só um erro pré-existente não relacionado muda de texto)
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
