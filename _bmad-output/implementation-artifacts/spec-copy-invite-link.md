---
title: 'Botão "Copiar link" de convite no perfil do jogador'
type: 'feature'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
context: []
---

# Botão "Copiar link" de convite no perfil do jogador

## Intent

**Problem:** No perfil do jogador (`/plantel/[id]`), a secção "Acesso à app" só permitia reenviar o email de convite (`Re-enviar convite`). Não havia forma de obter o link diretamente, para o staff partilhar por outro canal (ex.: WhatsApp) quando o email não chega ou o encarregado prefere outro meio.

**Approach:** Nova server action `getPlayerInviteLink()` — mesma validação/autorização de `resendPlayerInvite()` (staff coach/analyst, jogador do próprio clube, não arquivado, com email registado) mas em vez de `auth.admin.inviteUserByEmail()` (que cria/reenvia E dispara o envio do email), usa `auth.admin.generateLink({type: "invite", email, options: {data}})`, que gera o mesmo tipo de link sem enviar nada — devolve `properties.action_link` para a UI copiar. Não atualiza `invite_sent_at` (não é um reenvio), mas fica registado em `audit_logs` como `player.invite_link_copied`. Botão novo `CopyInviteLinkButton` (client component, mesma forma que `ResendInviteButton`) usa `navigator.clipboard.writeText()` e mostra estados "A gerar…" / "Copiado!" / "Erro ao copiar".

## Suggested Review Order

- Nova server action — mesma auth/scoping que `resendPlayerInvite`, troca `inviteUserByEmail` por `generateLink`.
  [`players.ts:1084`](../../sparta/src/lib/actions/players.ts#L1084)
- Botão novo (clipboard + estados).
  [`copy-invite-link-button.tsx`](../../sparta/src/app/(staff)/plantel/[id]/copy-invite-link-button.tsx)
- Integração no perfil, ao lado de "Re-enviar convite".
  [`plantel/[id]/page.tsx:392`](../../sparta/src/app/(staff)/plantel/[id]/page.tsx#L392)
- Testes da action (validação, unauthorized, forbidden por role, arquivado, sem email, sucesso com o action_link, falha do generateLink) e do botão (copia + estado de erro).
  [`invite.test.ts`](../../sparta/src/__tests__/lib/actions/invite.test.ts), [`copy-invite-link-button.test.tsx`](../../sparta/src/app/(staff)/plantel/[id]/copy-invite-link-button.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/lib/actions/invite.test.ts "src/app/(staff)/plantel/[id]/copy-invite-link-button.test.tsx"` -- expected: 36 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois

**Nota não verificável sem ambiente Supabase real:** assume-se que `generateLink({type:"invite"})` funciona para um utilizador já convidado mas ainda não confirmado (o mesmo caso que `resendPlayerInvite` já trata com sucesso via `inviteUserByEmail`, que internamente usa o mesmo mecanismo). Se o jogador já tiver a conta totalmente confirmada, o Supabase devolve erro (ex. "already registered") e o botão mostra "Erro ao copiar" — falha de forma segura, sem expor nada.
