---
title: 'Ordenação e filtro por posição no Plantel'
type: 'feature'
created: '2026-08-04'
status: 'done'
route: 'one-shot'
context: []
---

# Ordenação e filtro por posição no Plantel

## Intent

**Problem:** A lista de jogadores em `/plantel` (agrupada por escalão) só tinha uma ordem fixa (último nome), sem forma de ordenar por Número, Nome ou Posição, nem de filtrar por posição.

**Approach:** Ordenação e filtro aplicados dentro de cada secção de escalão (mantendo o agrupamento), com estado em query string (`?ordenar=numero|posicao&posicao=<código>`) — mesmo padrão já usado por `?view=inativos` nesta página e por `vista`/`cumulativo` no calendário, para sobreviver a round-trips de navegação (ex: criar jogador e voltar) sem perder o estado. "Posição" ordena pela ordem declarada em `POSITIONS` (guarda-redes → defesa → médio → avançado), mais intuitiva para um treinador do que ordem alfabética. O filtro só lista posições realmente presentes no plantel carregado.

## Suggested Review Order

**Lógica pura (testada)**

- `sortPlayers`/`filterPlayersByPosition` — ordenação por nome/número/posição e filtro pela posição primária.
  [`player-sort.ts`](../../sparta/src/lib/utils/player-sort.ts)
- `buildPlantelSortFilterQuery` — query string partilhada entre os controlos e o toggle Ver activos/inativos.
  [`plantel-query.ts`](../../sparta/src/lib/utils/plantel-query.ts)

**Página**

- Lê `ordenar`/`posicao` da query, valida, calcula `availablePositions` a partir do plantel carregado, aplica filtro+ordenação por escalão.
  [`page.tsx:39`](../../sparta/src/app/(staff)/plantel/page.tsx#L39)
- Fix da revisão: "Ver activos"/"Ver inativos" agora preservam `ordenar`/`posicao` (antes eram links fixos, perdiam o estado ao trocar de vista — mesma classe de bug já corrigida no calendário nesta sessão).
  [`page.tsx:89`](../../sparta/src/app/(staff)/plantel/page.tsx#L89)

**Controlo client-side**

- Separadores de ordenação + `<select>` de posição, mesmo padrão de `CalendarViewToggle`/`SessionTypeFilter`.
  [`PlantelListControls.tsx`](../../sparta/src/components/patterns/PlantelListControls.tsx)

**Testes**

- [`player-sort.test.ts`](../../sparta/src/__tests__/lib/utils/player-sort.test.ts)
- [`plantel-query.test.ts`](../../sparta/src/__tests__/lib/utils/plantel-query.test.ts)
- [`plantel-list-controls.test.tsx`](../../sparta/src/__tests__/components/plantel-list-controls.test.tsx)
