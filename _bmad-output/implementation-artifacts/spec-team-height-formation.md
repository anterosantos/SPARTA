---
title: 'Segunda vista "Equipa por posição" — altura, mesmo racional do peso'
type: 'feature'
created: '2026-08-07'
status: 'done'
route: 'one-shot'
context: []
---

# Segunda vista "Equipa por posição" — altura, mesmo racional do peso

## Intent

**Problem:** Depois de `spec-team-weight-formation.md` + `spec-team-weight-formation-adjustments.md` (peso), pedido para replicar exatamente a mesma vista para altura: campo com jogadores por posição, bola dimensionada e colorida pela última altura registada, com o mesmo racional de peso por omissão (média do plantel menos 1 — desta vez 1 cm em vez de 1 kg).

**Approach:** A escala de cor/tamanho (interpolação azul→âmbar→vermelho, 24–64px) já não é específica de peso — foi extraída para `src/lib/heat-scale.ts` (`makeHeatScale(min, max)`), usada por `TeamWeightFormation` (refactor sem alteração de comportamento — os 17 testes existentes continuam a passar com os mesmos valores esperados) e pelo novo `TeamHeightFormation` (limites 100–220 cm, os mesmos de `PlayerMetricCreateSchema`). `getTeamAggregateData()` já tinha uma query a `player_metrics` filtrada a `weight_kg IS NOT NULL` — como uma leitura pode ter só peso ou só altura (Nova leitura já suporta isso, ver `spec-fix-metric-sheet-single-field.md`), o filtro foi removido e a query devolve `weight_kg`+`height_cm`+`recorded_at` juntos; cada dimensão é reduzida a "primeira ocorrência não-nula por jogador" separadamente. `PlayerFormationItem` ganhou `heightCm`/`hasHeightReading`, com o mesmo racional de omissão do peso (média do plantel − 1, fallback de 160cm só quando não há nenhuma leitura de altura em todo o plantel). Segunda secção no dashboard, logo a seguir à do peso.

## Suggested Review Order

- Escala de cor/tamanho generalizada (usada por peso e altura).
  [`heat-scale.ts`](../../sparta/src/lib/heat-scale.ts)
- Query a `player_metrics` deixa de filtrar por `weight_kg` — extração separada de peso e altura por jogador, ambos com o mesmo racional de omissão (média − 1).
  [`team-aggregate.ts:223`](../../sparta/src/lib/actions/team-aggregate.ts#L223) (query), [`team-aggregate.ts:408`](../../sparta/src/lib/actions/team-aggregate.ts#L408) (processamento)
- `TeamWeightFormation` refatorado para usar a escala partilhada (API pública inalterada).
  [`TeamWeightFormation.tsx`](../../sparta/src/components/domain/TeamWeightFormation.tsx)
- Novo componente espelho para altura.
  [`TeamHeightFormation.tsx`](../../sparta/src/components/domain/TeamHeightFormation.tsx)
- Segunda secção no dashboard.
  [`TeamAggregateDashboard.tsx`](../../sparta/src/components/domain/TeamAggregateDashboard.tsx)
- Testes: escala partilhada, cálculo de altura (default + mais recente + leituras parciais peso/altura na mesma sessão), componente de altura, e regressão de peso/prontidão.
  [`heat-scale.test.ts`](../../sparta/src/lib/heat-scale.test.ts), [`team-aggregate.test.ts`](../../sparta/src/lib/actions/team-aggregate.test.ts), [`TeamHeightFormation.test.tsx`](../../sparta/src/components/domain/TeamHeightFormation.test.tsx), [`TeamWeightFormation.test.tsx`](../../sparta/src/components/domain/TeamWeightFormation.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/readiness src/lib/actions/team-aggregate.test.ts src/components/domain/TeamWeightFormation.test.tsx src/components/domain/TeamHeightFormation.test.tsx src/lib/heat-scale.test.ts` -- expected: 119 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
