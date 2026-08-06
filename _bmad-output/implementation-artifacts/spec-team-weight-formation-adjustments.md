---
title: 'Ajustes à vista "Equipa por posição": escala de cor, peso por omissão e posição no ecrã'
type: 'feature'
created: '2026-08-07'
status: 'done'
route: 'one-shot'
context: []
---

# Ajustes à vista "Equipa por posição": escala de cor, peso por omissão e posição no ecrã

## Intent

**Problem:** Após o primeiro shipping de `spec-team-weight-formation.md`, três ajustes pedidos: (1) as bolas só variavam de tamanho, sem cor; (2) o peso por omissão (50 kg fixo) não refletia o plantel real; (3) a secção do campo aparecia logo a seguir aos filtros, antes dos gráficos.

**Approach:**
- **Escala de cor**: `weightToColor()` interpola azul→âmbar→vermelho (30–150 kg, mesmos limites do tamanho), com legenda gráfica por baixo do campo. Bolas sem leitura ganham contorno tracejado (em vez de sólido) para se distinguirem visualmente das reais.
- **Peso por omissão**: deixa de ser uma constante fixa — passa a ser a média dos pesos registados no plantel menos 1 kg (calculada em `getTeamAggregateData()` a partir de `lastWeightByPlayer`, antes de construir `squadFormation`). Só recorre ao antigo valor fixo (50 kg) quando **nenhum** jogador do plantel tem qualquer leitura — nesse caso não há média para calcular.
- **Posição no ecrã**: secção movida do topo (antes dos gráficos de linha) para o fundo do dashboard (depois de "Eventos por Jogo / Amigável").

## Suggested Review Order

- Peso por omissão passa a média − 1 kg (com fallback de último recurso).
  [`team-aggregate.ts:407`](../../sparta/src/lib/actions/team-aggregate.ts#L407)
- Escala de cor + legenda + contorno tracejado para valores por omissão.
  [`TeamWeightFormation.tsx`](../../sparta/src/components/domain/TeamWeightFormation.tsx)
- Secção movida para o fundo do dashboard.
  [`TeamAggregateDashboard.tsx`](../../sparta/src/components/domain/TeamAggregateDashboard.tsx)
- Testes: nova média−1kg, escala de cor nos limites e no meio, contorno tracejado, legenda.
  [`team-aggregate.test.ts`](../../sparta/src/lib/actions/team-aggregate.test.ts), [`TeamWeightFormation.test.tsx`](../../sparta/src/components/domain/TeamWeightFormation.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/lib/actions/team-aggregate.test.ts src/components/domain/TeamWeightFormation.test.tsx src/__tests__/readiness` -- expected: 95 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
