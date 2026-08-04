---
title: 'Aplicar template de email de consentimento parental em consent.ts'
type: 'bugfix'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
context: []
---

# Aplicar template de email de consentimento parental em consent.ts

## Intent

**Problem:** O template de email "melhorado" aplicado ontem em `send-parental-consent/index.ts` não aparecia no email real recebido pelos encarregados. Investigação revelou que existem **três** sítios distintos que enviam este email, cada um com HTML embutido próprio:
1. `sparta/src/lib/actions/consent.ts` → `initiateParentalConsent()` — email inicial (o que o utilizador recebeu)
2. `sparta/src/lib/actions/consent.ts` → `resendConsentEmail()` — reenvio manual pelo staff
3. `sparta/supabase/functions/send-parental-consent/index.ts` → lembretes automáticos dia-7/dia-14 (o único já corrigido ontem)

**Approach:** Extraído `parentalConsentEmailHtml()` como helper partilhado dentro de `consent.ts` (usado pelos dois primeiros — vivem no mesmo ficheiro/runtime Next.js). Não é partilhável com a Edge Function (runtime Deno separado, sem import cruzado) — mantido como cópia sincronizada manualmente, documentado no comentário do helper.

## Suggested Review Order

- Helper partilhado, mesmo template (bullets, nome do jogador, rodapé) já usado na Edge Function.
  [`consent.ts:11`](../../sparta/src/lib/actions/consent.ts#L11)
- `initiateParentalConsent` — adiciona `full_name` ao select (não estava a ser lido) e usa o helper.
  [`consent.ts:113`](../../sparta/src/lib/actions/consent.ts#L113)
- `resendConsentEmail` — usa o helper com `reminder: true`; também passa a enviar `textContent` (antes só enviava `htmlContent`).
  [`consent.ts:334`](../../sparta/src/lib/actions/consent.ts#L334)
- Testes: conteúdo do email agora verificado (nome, bullets, rodapé), não só que o Brevo foi chamado.
  [`consent.test.ts`](../../sparta/src/__tests__/lib/actions/consent.test.ts)

## Design Notes

Não tocado: `sendConsentConfirmationEmail` (email diferente — confirma que o consentimento *foi* registado, não pede autorização) — fora do âmbito deste pedido específico, mas com o mesmo problema de HTML básico embutido caso seja pedido no futuro.

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/lib/actions/consent.test.ts` -- expected: 14 testes a passar
- `cd sparta && npm run build` -- expected: compila sem erros
