---
title: 'Vista Mês por omissão + sessões como retângulos coloridos (estilo Google Calendar)'
type: 'feature'
created: '2026-08-12'
status: 'done'
route: 'plan-code-review'
context: []
---

# Vista Mês por omissão + sessões como retângulos coloridos (estilo Google Calendar)

## Intent

**Problem:** Nas vistas Calendário (staff) e Agenda (jogador), a vista por omissão ao abrir era Semana; pedido para passar a Mês. Na vista Mês, cada sessão aparecia como uma barra fina colorida sob o número do dia; pedido para mostrar um retângulo preenchido com a cor do tipo de sessão, com a hora e o tipo dentro — como no Google Calendar.

**Approach:**
- Três pontos decidiam a vista por omissão de forma independente (tinham de mudar em conjunto): `CalendarViewToggle` (que aba fica activa), e as duas páginas (`calendario/page.tsx`, `agenda/page.tsx`, que decidem qual componente renderizar). Todos invertidos de `vista ?? "semana"` para `vista === "semana" ? "semana" : "mes"`.
- `buildCalendarViewQuery()` (usado para preservar a vista ao navegar para "Nova sessão" e voltar) invertido correspondentemente: omite `vista=` quando é "mes" (agora o default), inclui-o explicitamente para "semana".
- `MonthGrid`: cada sessão passa de uma `<span>` de 4px de altura para um `<div>` com `background-color` da cor do tipo, texto branco "HH:mm Tipo" truncado dentro. Altura mínima da célula do dia aumentada (56px → 84px) para acomodar até 3 retângulos com texto.

## Suggested Review Order

- Vista por omissão invertida nos três pontos.
  [`calendar-view-toggle.tsx`](../../sparta/src/components/ui/calendar-view-toggle.tsx), [`calendario/page.tsx`](../../sparta/src/app/(staff)/calendario/page.tsx), [`agenda/page.tsx`](../../sparta/src/app/(player)/agenda/page.tsx)
- `buildCalendarViewQuery` — lógica de omissão invertida.
  [`calendar-query.ts`](../../sparta/src/lib/utils/calendar-query.ts)
- Retângulos coloridos com hora+tipo em vez de barras.
  [`month-grid.tsx:94`](../../sparta/src/components/ui/month-grid.tsx#L94)
- Testes: default Mês em ambas as páginas (com `?vista=semana` a continuar a funcionar), `buildCalendarViewQuery` invertido, novo formato de retângulo no MonthGrid.
  [`calendario.test.tsx`](../../sparta/src/__tests__/app/calendario.test.tsx), [`agenda.test.tsx`](../../sparta/src/__tests__/app/agenda.test.tsx), [`calendar-query.test.ts`](../../sparta/src/__tests__/lib/utils/calendar-query.test.ts), [`month-grid.test.tsx`](../../sparta/src/components/ui/month-grid.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/components/ui/month-grid.test.tsx src/__tests__/app/calendario.test.tsx src/__tests__/app/agenda.test.tsx src/__tests__/lib/utils/calendar-query.test.ts` -- expected: 22 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
