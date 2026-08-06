---
title: 'Equipa por posição com bolas dimensionadas pelo peso (Equipa Agregada)'
type: 'feature'
created: '2026-08-06'
status: 'done'
route: 'one-shot'
context: []
---

# Equipa por posição com bolas dimensionadas pelo peso (Equipa Agregada)

## Intent

**Problem:** Em `/equipa/agregado`, não havia uma vista que mostrasse o plantel distribuído no campo por posição, com o peso de cada jogador representado visualmente. Pedido: usar uma imagem de campo de futebol, uma bola por jogador posicionada pela posição primária, com o tamanho da bola a representar o último peso registado — 50 kg por omissão quando não há leituras.

**Approach:** Reaproveitado o motor de posicionamento já existente e testado em `field-formation.tsx` (prontidão) — extraído para `src/lib/field-layout.ts` (tabela de coordenadas por posição, `spreadHorizontal`, `layoutByPosition` genérico) e para `src/components/ui/football-pitch-svg.tsx` (o SVG do campo), sem alterar o comportamento visível (19 + 9 testes de prontidão continuam a passar inalterados). `getTeamAggregateData()` passou a devolver `squadFormation: PlayerFormationItem[]` — para cada jogador do plantel do staff, a última leitura de peso não nula em `player_metrics` (ou 50 kg + `hasWeightReading: false` se não houver nenhuma). Novo componente `TeamWeightFormation` reusa `layoutByPosition`/`FootballPitchSvg` e mapeia peso→tamanho da bola (24–64px, linear entre os limites 30–150 kg já usados em `PlayerMetricCreateSchema`). Secção nova no dashboard, respeitando o filtro de grupo etário já existente.

## Suggested Review Order

- Motor de layout partilhado extraído (comportamento preservado — thin wrapper em `field-formation.tsx`).
  [`field-layout.ts`](../../sparta/src/lib/field-layout.ts), [`field-formation.tsx:33`](../../sparta/src/components/domain/readiness/field-formation.tsx#L33)
- SVG do campo extraído para componente partilhado.
  [`football-pitch-svg.tsx`](../../sparta/src/components/ui/football-pitch-svg.tsx)
- Última leitura de peso por jogador (peso por omissão 50 kg).
  [`team-aggregate.ts:199`](../../sparta/src/lib/actions/team-aggregate.ts#L199) (query), [`team-aggregate.ts:403`](../../sparta/src/lib/actions/team-aggregate.ts#L403) (squadFormation)
- Novo componente — bola por jogador, tamanho = peso.
  [`TeamWeightFormation.tsx`](../../sparta/src/components/domain/TeamWeightFormation.tsx)
- Integração no dashboard (respeita filtro de grupo etário já existente).
  [`TeamAggregateDashboard.tsx:83`](../../sparta/src/components/domain/TeamAggregateDashboard.tsx#L83)
- Testes: cálculo de peso (default + mais recente), tamanho da bola, layout, e regressão de prontidão após o refactor partilhado.
  [`team-aggregate.test.ts`](../../sparta/src/lib/actions/team-aggregate.test.ts), [`TeamWeightFormation.test.tsx`](../../sparta/src/components/domain/TeamWeightFormation.test.tsx), [`field-formation.test.tsx`](../../sparta/src/__tests__/readiness/field-formation.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/readiness src/lib/actions/team-aggregate.test.ts src/components/domain/TeamWeightFormation.test.tsx` -- expected: 87 testes a passar (confirma zero regressão em prontidão após o refactor partilhado)
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
  - Nota: build apanhou uma violação real da Regra 2 do AGENTS.md (`export const DEFAULT_WEIGHT_KG` num ficheiro `"use server"`) que `tsc`/`vitest` não detectam — corrigido tornando a constante não-exportada.
