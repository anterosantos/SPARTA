---
title: 'Mostrar "vs Adversário" em Jogo/Amigável em todos os ecrãs'
type: 'feature'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
context: []
---

# Mostrar "vs Adversário" em Jogo/Amigável em todos os ecrãs

## Intent

**Problem:** O campo `opponent_name` já era capturado no formulário de sessão (ver `spec-session-opponent-name-field.md`) e usado na convocatória, mas nunca aparecia em nenhum ecrã de visualização — a semana/mês do calendário, os cartões de "Próximos 7 dias", o `SessionCard` (Hoje, Sessões) e as páginas de detalhe de sessão (staff e jogador) mostravam só "Amigável"/"Jogo", sem indicar contra quem.

**Approach:** Adicionado `sessionLabelWithOpponent(label, session)` a `session-colors.ts` — devolve `"{label} vs {opponent_name}"` quando `type` é `match`/`friendly` e `opponent_name` está definido, senão devolve o label original inalterado (Treino/Palestra nunca são afetados). Aplicado nos cinco pontos onde um label de tipo de sessão é renderizado: `SessionBlock` (vista semana/dia do calendário — o ecrã do screenshot do pedido), `NextSevenDaysList` (usado tanto pela vista semana como mês), `SessionCard` (Hoje, lista de Sessões), e as duas páginas de detalhe (`(staff)/sessoes/[id]` e `(player)/agenda/[sessionId]`). A vista de mês (`month-grid.tsx`) só mostra pontos de cor, sem texto — não aplicável.

## Suggested Review Order

- Helper partilhado.
  [`session-colors.ts:16`](../../sparta/src/lib/constants/session-colors.ts#L16)
- Vista semana/dia do calendário (o ecrã pedido).
  [`session-block.tsx:20`](../../sparta/src/components/ui/session-block.tsx#L20)
- Lista "Próximos 7 dias" (partilhada entre vista semana e mês).
  [`next-seven-days-list.tsx:23`](../../sparta/src/components/ui/next-seven-days-list.tsx#L23)
- Cartão de sessão (Hoje, Sessões).
  [`session-card.tsx:33`](../../sparta/src/components/ui/session-card.tsx#L33)
- Detalhe da sessão — staff.
  [`sessoes/[id]/page.tsx:58`](../../sparta/src/app/(staff)/sessoes/[id]/page.tsx#L58)
- Detalhe da sessão — jogador.
  [`agenda/[sessionId]/page.tsx:40`](../../sparta/src/app/(player)/agenda/[sessionId]/page.tsx#L40)
- Testes de cada ponto de renderização, incluindo o fix de dívida de tipos pré-existente nos fixtures de teste (`Session` já exigia `concentration_time`/`opponent_name`, os fixtures não os tinham).
  [`session-block.test.tsx`](../../sparta/src/components/ui/session-block.test.tsx), [`next-seven-days-list.test.tsx`](../../sparta/src/components/ui/next-seven-days-list.test.tsx), [`session-card.test.tsx`](../../sparta/src/__tests__/components/session-card.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/components/ui/session-block.test.tsx src/components/ui/next-seven-days-list.test.tsx src/components/ui/__tests__/session-card.test.tsx src/__tests__/components/session-card.test.tsx` -- expected: 39 testes a passar
- `cd sparta && npx tsc --noEmit` -- expected: sem erros nos ficheiros tocados (fixtures de `Session` agora completos)
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
