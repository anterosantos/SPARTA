---
title: 'Mostrar hora de fim calculada (início + duração) nos ecrãs de sessão'
type: 'feature'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
context: []
---

# Mostrar hora de fim calculada (início + duração) nos ecrãs de sessão

## Intent

**Problem:** Os ecrãs de sessão mostravam "18:30 · 105 min" — a duração em minutos, sem a hora de fim explícita. Pedido: mostrar a hora de fim, calculada a partir do início + duração, só para efeitos de visualização (sem persistir nada na base de dados). Aplica-se a qualquer tipo de sessão (treino e jogo).

**Approach:** Criado `sessionEndDate(scheduledAt, durationMin)` em `session-time.ts` — soma a duração (ms) à data de início, sem tocar em nada persistido. Aplicado nos três ecrãs onde a hora de início já era mostrada junto da duração: vista semana/dia do calendário (`SessionBlock`), cartões de sessão (`SessionCard` — Hoje, lista de Sessões) e detalhe da sessão do jogador. Formato escolhido (confirmado com o utilizador): intervalo "18:30 - 20:15", substituindo o "· 105 min" em vez de o manter ao lado.

## Suggested Review Order

- Helper de cálculo (display-only, não persiste nada).
  [`session-time.ts`](../../sparta/src/lib/session-time.ts)
- Vista semana/dia do calendário — "18:30 · 105 min" → "18:30 - 20:15".
  [`session-block.tsx:20`](../../sparta/src/components/ui/session-block.tsx#L20)
- Cartão de sessão (Hoje, Sessões) — "07/05 às 17:00" → "07/05 às 17:00 - 18:30".
  [`session-card.tsx:40`](../../sparta/src/components/ui/session-card.tsx#L40)
- Detalhe da sessão do jogador.
  [`agenda/[sessionId]/page.tsx:46`](../../sparta/src/app/(player)/agenda/[sessionId]/page.tsx#L46)
- Testes com hora dinâmica (calculada com o mesmo `sessionEndDate`/`format` do componente, em vez de string fixa) para não depender do fuso horário da máquina onde os testes correm.
  [`session-time.test.ts`](../../sparta/src/lib/session-time.test.ts), [`session-block.test.tsx`](../../sparta/src/components/ui/session-block.test.tsx), [`session-card.test.tsx`](../../sparta/src/__tests__/components/session-card.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/lib/session-time.test.ts src/components/ui/session-block.test.tsx src/__tests__/components/session-card.test.tsx src/components/ui/__tests__/session-card.test.tsx` -- expected: 38 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
