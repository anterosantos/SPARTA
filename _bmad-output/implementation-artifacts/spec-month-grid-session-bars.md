---
title: 'Substituir pontinhos por barras grossas na vista mês do calendário'
type: 'feature'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
context: []
---

# Substituir pontinhos por barras grossas na vista mês do calendário

## Intent

**Problem:** Na vista mês do calendário (`/calendario`), cada dia mostrava até 3 pontinhos circulares (um por sessão) sem ordem definida. Pedido: substituir por linhas grossas, empilhadas de cima para baixo pela hora da sessão — a mais cedo em cima, a mais tarde em baixo.

**Approach:** `MonthGrid` passou a ordenar as sessões de cada dia por `scheduled_at` (ascendente) antes de as limitar a 3, e o contentor mudou de `flex flex-wrap` (pontinhos numa grelha horizontal) para `flex flex-col` (barras empilhadas verticalmente). Cada pontinho `w-1.5 h-1.5 rounded-full` passou a barra `h-1 w-full rounded-sm`, mantendo a cor por tipo de sessão (`SESSION_TYPE_COLORS`). O indicador "+N" para excesso mantém-se, agora centrado por baixo das barras. Altura mínima da célula aumentada ligeiramente (52px → 56px) para acomodar 3 barras empilhadas.

## Suggested Review Order

- Ordenação por hora + troca de pontinhos por barras.
  [`month-grid.tsx:68`](../../sparta/src/components/ui/month-grid.tsx#L68)
- Testes: barra em vez de pontinho, ordem cedo→tarde, limite de 3 + "+N", clique no dia.
  [`month-grid.test.tsx`](../../sparta/src/components/ui/month-grid.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/components/ui/month-grid.test.tsx src/__tests__/app/calendario.test.tsx` -- expected: 10 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
