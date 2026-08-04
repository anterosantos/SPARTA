---
title: 'Remover botões "Época actual"/"Cumulativo" do calendário'
type: 'feature'
created: '2026-08-04'
status: 'done'
route: 'one-shot'
context: []
---

# Remover botões "Época actual"/"Cumulativo" do calendário

## Intent

**Problem:** `/calendario` mostrava os botões "Época actual"/"Cumulativo" (`SeasonToggle`), permitindo ver todas as sessões do clube sem filtro de época. Deixaram de ser necessários neste ecrã.

**Approach:** Remover `SeasonToggle` e o seu ramo de fetch (`isCumulative` / `getSessionsForClub()` sem filtro) de `calendario/page.tsx` — a página passa a mostrar sempre a época actual. `SeasonToggle` (componente partilhado, usado noutras páginas) e `?cumulativo=true` nessas páginas não são tocados. `buildCalendarViewQuery()` deixa de aceitar `cumulativo` (nada resta para fazer round-trip).

## Suggested Review Order

- Remove o ramo `isCumulative`/`SeasonToggle`; a página passa sempre pela época actual.
  [`page.tsx:65`](../../sparta/src/app/(staff)/calendario/page.tsx#L65)
- `prevMonthHref`/`nextMonthHref` passam a usar `buildCalendarViewQuery` (consolidação da revisão — eram construídos à mão, duplicando a mesma lógica usada para "Nova sessão").
  [`page.tsx:98`](../../sparta/src/app/(staff)/calendario/page.tsx#L98)
- Helper partilhado perde o parâmetro `cumulativo`.
  [`calendar-query.ts`](../../sparta/src/lib/utils/calendar-query.ts)
- Testes actualizados: sem "Época actual"/"Cumulativo" visíveis, sem casos de fetch cumulativo.
  [`calendario.test.tsx`](../../sparta/src/__tests__/app/calendario.test.tsx)
