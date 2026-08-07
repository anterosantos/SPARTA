---
title: 'Consentimento parental: iniciar por email ou copiar link (com nome do encarregado)'
type: 'feature'
created: '2026-08-07'
status: 'done'
route: 'plan-code-review'
context: []
---

# Consentimento parental: iniciar por email ou copiar link (com nome do encarregado)

## Intent

**Problem:** No perfil do jogador, "Iniciar consentimento" só permitia enviar um email — sem alternativa para o staff partilhar o pedido por outro canal (ex.: WhatsApp), como já existe para o convite de acesso à app.

**Approach:** Botão renomeado para "Iniciar Consentimento por email"; novo botão "Copiar Link" ao lado, que pede o **nome** do encarregado (não o email — este fluxo não envia nada) antes de gerar o link e copiá-lo. Como `parental_consents.parent_email` era `NOT NULL`, foi necessário: tornar a coluna opcional, adicionar `parent_name`, e exigir que pelo menos uma das duas exista (`CHECK`). "Aguarda resposta de" / "Consentido por" mostram `parent_name ?? parent_email`. O botão "Reenviar" (email) só aparece quando há email — não faz sentido para um pedido por link.

Duas correções relacionadas, descobertas ao rever o caminho completo desta alteração:
1. **`processConsentDecision` tinha um guard errado** — `if (!consent?.parent_email) return` tratava "token não encontrado" e "sem email" da mesma forma, fazendo com que confirmar/retirar um consentimento por link fosse sempre um no-op silencioso (nunca mudava de estado). Corrigido para `if (!consent) return`, com o envio do email de confirmação agora condicional a `parent_email` existir.
2. **Lembretes automáticos (dia 7/dia 14)** — o job `pg_cron` já selecionava todos os pendentes sem filtrar por email; sem correção, tentaria enviar lembretes Brevo para `parent_email = null` todos os dias. Adicionado `AND parent_email IS NOT NULL` às duas queries (migration recria a função `parental_consent_reminders()`).

## Suggested Review Order

- Migration: `parent_email` opcional + `parent_name` + constraint + fix ao cron de lembretes.
  [`000395_parental_consent_link_only.sql`](../../sparta/supabase/migrations/000395_parental_consent_link_only.sql)
- Nova action (mesma auth/validação de `initiateParentalConsent`, sem envio de email).
  [`consent.ts:296`](../../sparta/src/lib/actions/consent.ts#L296) (`getParentalConsentLink`)
- **Fix de regressão** no guard de `processConsentDecision` (bug pré-existente, exposto por este fluxo).
  [`consent.ts:663`](../../sparta/src/lib/actions/consent.ts#L663)
- Botão "Copiar Link" (pede nome antes de copiar).
  [`copy-consent-link-sheet.tsx`](../../sparta/src/app/(staff)/plantel/[id]/copy-consent-link-sheet.tsx)
- Integração no perfil: dois botões no estado "sem consentimento"; "Aguarda resposta de"/"Consentido por" com fallback nome→email; "Reenviar" só quando há email.
  [`plantel/[id]/page.tsx`](../../sparta/src/app/(staff)/plantel/[id]/page.tsx)
- Ecrã do jogador ("A aguardar consentimento") — mensagem adaptada quando não há email.
  [`aguardar-consentimento/page.tsx`](../../sparta/src/app/(player)/aguardar-consentimento/page.tsx)
- Testes: nova action, regressão do guard (confirma mesmo sem email, não tenta enviar Brevo), botão de copiar, ecrã de espera do jogador.
  [`consent.test.ts`](../../sparta/src/__tests__/lib/actions/consent.test.ts), [`copy-consent-link-sheet.test.tsx`](../../sparta/src/app/(staff)/plantel/[id]/copy-consent-link-sheet.test.tsx), [`aguardar-consentimento.test.tsx`](../../sparta/src/__tests__/app/aguardar-consentimento.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/lib/actions/consent.test.ts "src/app/(staff)/plantel/[id]/copy-consent-link-sheet.test.tsx" src/__tests__/app/aguardar-consentimento.test.tsx` -- expected: 30 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois

**Não verificável sem ambiente Supabase real:** a migration recria `parental_consent_reminders()` (função pg_cron) — não é possível confirmar em CI que o job corre correctamente em produção, só que a definição SQL está correcta e consistente com a versão actualmente implantada (confirmada via `000173b_update_reminders_log_status.sql`).
