---
title: 'Reenviar convite + Copiar link no ecrã de gestão de treinadores'
type: 'feature'
created: '2026-08-06'
status: 'done'
route: 'one-shot'
context: []
---

# Reenviar convite + Copiar link no ecrã de gestão de treinadores

## Intent

**Problem:** `/admin/coaches` já tinha o equivalente para jogadores ("Re-enviar convite" + "Copiar link" no perfil do jogador, ver `spec-copy-invite-link.md`), mas na tabela "Treinadores em Equipas" só existia "Remover" — sem forma de reenviar o email de convite a um treinador/analista já criado, nem de copiar o link para partilhar por outro canal.

**Approach:** `profiles` (treinador/analista) não tem `invite_sent_at` nem email próprio (o email só existe em `auth.users`) — criado um helper `getInvitedCoachEmail()` em `admin.ts` que valida que o perfil pertence ao clube do admin e tem role coach/analyst, depois busca o email via `serviceRole.auth.admin.getUserById()`. Duas novas actions reutilizam este helper: `resendCoachInvite()` (chama `inviteUserByEmail`, mesmo mecanismo que `inviteCoach` já usa) e `getCoachInviteLink()` (chama `generateLink({type:"invite"})`, devolve o `action_link` sem enviar nada — mesmo padrão já usado para jogadores em `getPlayerInviteLink`). Ambas gated por `requireAdminRole()` (a mesma guarda já usada por todas as actions desta página) e registadas em `audit_logs` (`profiles.invite_resent` / `profiles.invite_link_copied`).

## Suggested Review Order

- Helper partilhado + duas novas actions.
  [`admin.ts:1589`](../../sparta/src/lib/actions/admin.ts#L1589)
- "Reenviar" (form action, mesmo padrão progressive-enhancement que "Remover") + banner de sucesso distinto do de "Convite enviado".
  [`coaches/page.tsx:61`](../../sparta/src/app/(staff)/admin/coaches/page.tsx#L61)
- "Copiar link" (client component, clipboard).
  [`CopyCoachInviteLinkButton.tsx`](../../sparta/src/app/(staff)/admin/coaches/CopyCoachInviteLinkButton.tsx)
- Testes das duas actions (unauthorized, perfil não encontrado, sucesso, falhas do Supabase) e do botão de copiar.
  [`coach-invite-link.test.ts`](../../sparta/src/__tests__/lib/actions/coach-invite-link.test.ts), [`CopyCoachInviteLinkButton.test.tsx`](../../sparta/src/app/(staff)/admin/coaches/CopyCoachInviteLinkButton.test.tsx)

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/lib/actions/coach-invite-link.test.ts "src/app/(staff)/admin/coaches/CopyCoachInviteLinkButton.test.tsx"` -- expected: 10 testes a passar
- `cd sparta && npm run build` -- expected: build limpo; `git checkout -- sparta/public/sw.js` depois

**Nota:** tal como no equivalente para jogadores, não é possível verificar num ambiente Supabase real que `generateLink`/`inviteUserByEmail` funcionam para um treinador já convidado mas ainda não confirmado — a lógica espelha exatamente o que `resendPlayerInvite`/`getPlayerInviteLink` já fazem (mesmo padrão, já em produção).
