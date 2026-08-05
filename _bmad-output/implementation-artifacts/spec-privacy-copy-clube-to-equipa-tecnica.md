---
title: 'Substituir "clube" por "equipa técnica" nos emails e na política de privacidade'
type: 'feature'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
context: []
---

# Substituir "clube" por "equipa técnica" nos emails e na política de privacidade

## Intent

**Problem:** Copy dirigida aos encarregados de educação (emails de consentimento parental, política de privacidade) usava "clube" onde o pedido era usar "equipa técnica" — ex: "o teu clube" → "a tua equipa técnica", "pelo clube" → "pela equipa técnica".

**Approach:** Substituição direta com concordância de género em português (o/do/pelo → a/da/pela). Política de privacidade tratada como **nova versão** (1.1.0, migration), não edição da 1.0.0 em vigor — preserva o histórico do que os encarregados já aceitaram, consistente com o desenho de versionamento da Story 3.1.

## Suggested Review Order

- Email de consentimento parental (fonte partilhada, cobre envio inicial + reenvio manual).
  [`consent.ts:45`](../../sparta/src/lib/actions/consent.ts#L45)
- Mesma frase na Edge Function dos lembretes automáticos (cópia separada, runtime Deno).
  [`send-parental-consent/index.ts:28`](../../sparta/supabase/functions/send-parental-consent/index.ts#L28)
- Nova versão 1.1.0 da política de privacidade — insere nova linha, o trigger `ensure_single_current_policy` já existente trata da transição atómica de `is_current`.
  [`000394_privacy_policy_v1_1_0.sql`](../../sparta/supabase/migrations/000394_privacy_policy_v1_1_0.sql)
- Fixture de desenvolvimento local atualizada para consistência (não afeta produção).
  [`seed.sql:72`](../../sparta/supabase/seed.sql#L72)

## Design Notes

Revisão adversarial confirmou o comportamento do trigger existente (testado desde a Story 3.1 para exatamente este caso — inserir uma nova versão `is_current=true`) e não encontrou problemas de fundo. Uma correção real aplicada: `effective_from` usava `CURRENT_DATE` (dinâmico), o que podia divergir do texto "em vigor desde 5 de agosto de 2026" escrito no corpo da política se o deploy acontecesse noutro dia — mudado para a data literal `'2026-08-05'`, igual ao padrão já usado na versão 1.0.0.

Não foram tocados os consentimentos já aceites (`parental_consents.policy_version_id` continua a apontar para a versão 1.0.0 que cada encarregado realmente viu) — o desenho de versionamento já existente trata disto corretamente, sem necessidade de novo fluxo de reconsentimento para uma mudança de terminologia menor.

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/lib/actions/consent.test.ts src/__tests__/app/politica-privacidade/page.test.tsx` -- expected: 21 testes a passar
- `cd sparta && npm run build` -- expected: compila sem erros

**Manual checks (if no CLI):**
- Depois do deploy da migration, confirmar em `/politica-privacidade` que mostra "Versão 1.1.0" e o texto com "equipa técnica".
