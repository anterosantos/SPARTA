---
title: 'Corrigir "Invalid input" ao registar só peso ou só altura'
type: 'bugfix'
created: '2026-08-06'
status: 'done'
route: 'one-shot'
context: []
---

# Corrigir "Invalid input" ao registar só peso ou só altura

## Intent

**Problem:** No sheet "Nova leitura" (Métricas físicas), deixar Altura vazio ao preencher só o Peso mostrava "Invalid input" e bloqueava o submit — mesmo o schema Zod (`weight_kg`/`height_cm` ambos `.optional()`, com `.refine` a exigir só um dos dois) já suportando este caso. Causa: `form.register(..., { valueAsNumber: true })` do react-hook-form converte um input vazio no `NaN` nativo do browser (`input.valueAsNumber`), não em `undefined` — e `z.number()` rejeita `NaN` mesmo sendo `.optional()`, com a mensagem genérica do Zod "Invalid input".

**Approach:** Trocado `valueAsNumber: true` por `setValueAs` em ambos os campos — converte a string vazia para `undefined` explicitamente antes de chegar ao Zod, e só faz `parseFloat` quando há valor. Reproduzido o bug com um teste antes do fix (`git stash` do componente) para confirmar a causa raiz.

## Suggested Review Order

- Fix nos dois campos.
  [`add-metric-sheet.tsx:109`](../../sparta/src/components/ui/add-metric-sheet.tsx#L109)
- Testes: só peso, só altura, e nenhum dos dois (mantém a mensagem custom do refine).
  [`add-metric-sheet.test.tsx`](../../sparta/src/components/ui/add-metric-sheet.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/components/ui/add-metric-sheet.test.tsx` -- expected: 3 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois
