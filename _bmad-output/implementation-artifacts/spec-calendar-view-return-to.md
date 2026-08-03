---
title: 'Preservar vista do calendário (Mês/Semana) ao criar sessão'
type: 'bugfix'
created: '2026-08-04'
status: 'done'
route: 'one-shot'
context: []
---

# Preservar vista do calendário (Mês/Semana) ao criar sessão

## Intent

**Problem:** `/calendario` guarda a vista atual (`vista=mes|semana`, `cumulativo`, `mes`) na query string. Ao clicar "Nova sessão" e depois submeter ou fechar o formulário, `session-form.tsx` fazia sempre `router.push("/calendario")` sem query string — perdendo a vista e devolvendo sempre o utilizador a "Semana".

**Approach:** `/calendario` passa a incluir a sua própria query string no link "Nova sessão"; `/calendario/nova` lê-a de volta e passa-a como prop `returnTo` a `SessionForm`, que a usa em vez do destino fixo. Lógica de construção da query string extraída para `buildCalendarViewQuery()` (helper partilhado), evitando duplicação entre as duas páginas.

## Suggested Review Order

**Fonte da verdade partilhada**

- Helper único que decide quais parâmetros (`cumulativo`/`vista`/`mes`) sobrevivem ao round-trip.
  [`calendar-query.ts`](../../sparta/src/lib/utils/calendar-query.ts)

**Round-trip: ida e volta**

- `/calendario` inclui a vista atual no link "Nova sessão".
  [`page.tsx:122`](../../sparta/src/app/(staff)/calendario/page.tsx#L122)
- `/calendario/nova` lê a query de volta e passa-a como `returnTo`.
  [`nova/page.tsx:41`](../../sparta/src/app/(staff)/calendario/nova/page.tsx#L41)
- `SessionForm` usa `returnTo` (default `"/calendario"`, preserva o comportamento de `/sessoes/nova`, que não passa a prop) em vez do destino fixo.
  [`session-form.tsx:93`](../../sparta/src/app/(staff)/calendario/session-form.tsx#L93)

**Testes**

- Helper de construção da query string.
  [`calendar-query.test.ts`](../../sparta/src/__tests__/lib/utils/calendar-query.test.ts)
- Regressão: `SessionForm` navega para `returnTo`, não para `/calendario` fixo.
  [`session-form.test.tsx:203`](../../sparta/src/__tests__/components/session-form.test.tsx#L203)
