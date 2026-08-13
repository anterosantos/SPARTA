---
title: 'Questionário pré-sessão: declarar ausência sem bloquear o pré, mas bloqueando o pós'
type: 'feature'
created: '2026-08-13'
status: 'done'
route: 'plan-code-review'
context: []
---

# Questionário pré-sessão: declarar ausência sem bloquear o pré, mas bloqueando o pós

## Intent

**Problem:** No questionário pré-sessão não era possível dizer se o jogador vai ou não à sessão. Pedido: acrescentar essa pergunta ao questionário pré; responder "Não" não pode impedir o preenchimento do próprio questionário pré, mas deve impedir o questionário pós-sessão dessa sessão.

**Approach:** Nova pergunta "Vais participar nesta sessão?" (Sim/Não) só na fase `pre` do `FatigueQuestionnaire`, reaproveitando o mecanismo de ausência já existente (`declarePlayerAbsence`/`cancelPlayerAbsence`, usado também no ecrã "Presença" em `/agenda/[sessionId]`). Ao responder "Não" e submeter, o questionário pré é gravado normalmente e, de seguida, `declarePlayerAbsence` marca o estado como `absent`. Responder "Sim" chama `cancelPlayerAbsence` (no-op se não estava ausente). Não responder (deixar `null`) preserva o comportamento anterior — nenhuma chamada é feita.

O bloqueio do pós é feito no guard server-side de `/questionario/[sessionId]/post`, que agora lê `getPlayerAttendanceForSession` e mostra página de erro se `status === "absent"` — o mesmo padrão já usado para bloquear palestras/médico/outros. Este guard só corre na fase `post`, por isso o pré nunca é afetado. O ecrã "Hoje" (`/hoje`) também deixa de sugerir o questionário pós de uma sessão recente se o jogador estiver marcado como ausente (mostra "Tudo registado" em vez disso).

**Nota:** a sincronização com `declarePlayerAbsence`/`cancelPlayerAbsence` só acontece no caminho online da submissão do questionário; em modo offline (outbox) a pergunta de presença é gravada no draft mas a sincronização de presença não é tentada (evita nova acção de rede numa submissão já pensada para funcionar sem rede) — o jogador pode sempre declarar ausência depois pelo ecrã "Presença" quando voltar a ter rede.

## Suggested Review Order

- Novo componente de pergunta Sim/Não.
  [`attendance-toggle.tsx`](../../sparta/src/components/domain/attendance-toggle.tsx)
- Questionário — pergunta só na fase pre + sincronização com presença após submissão online.
  [`fatigue-questionnaire.tsx`](../../sparta/src/components/ui/fatigue-questionnaire.tsx)
- Guard server-side — bloqueia `/questionario/[id]/post` se ausência declarada (não afeta `/pre`).
  [`questionario/[sessionId]/[phase]/page.tsx`](../../sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx)
- `/hoje` — não sugere questionário pós de sessão recente se o jogador estiver ausente.
  [`hoje/page.tsx`](../../sparta/src/app/(player)/hoje/page.tsx)
- Testes.
  [`fatigue-questionnaire.test.tsx`](../../sparta/src/__tests__/components/ui/fatigue-questionnaire.test.tsx), [`questionario page.test.tsx`](../../sparta/src/app/(player)/questionario/[sessionId]/[phase]/__tests__/page.test.tsx), [`hoje.test.tsx`](../../sparta/src/__tests__/app/hoje.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/components/ui/fatigue-questionnaire.test.tsx "src/app/(player)/questionario/[sessionId]/[phase]/__tests__/page.test.tsx" src/__tests__/app/hoje.test.tsx src/__tests__/app/agenda-session-detail.test.tsx src/__tests__/components/session-card.test.tsx src/components/ui/__tests__/session-card.test.tsx` -- expected: 86 testes a passar
- `cd sparta && npx tsc --noEmit` -- expected: sem novos erros (diff contra baseline `git stash`; aproveitou-se para corrigir 4 erros pré-existentes em `hoje.test.tsx` — fixture `mockSession` sem `concentration_time`/`opponent_name`)
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
