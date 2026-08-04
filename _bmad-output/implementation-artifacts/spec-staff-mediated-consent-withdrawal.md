---
title: 'Retirada de consentimento mediada por staff (RGPD Art. 21)'
type: 'feature'
created: '2026-08-05'
status: 'done'
route: 'plan-code-review'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O único fluxo existente para retirar o consentimento de um jogador (RGPD Art. 21 — apagamento em cascata imediato e irreversível) é self-service: o próprio titular autenticado, ou o encarregado de educação via token por email. Não havia forma de o staff agir em nome de um pedido recebido por telefone/email.

**Approach:** Nova server action `withdrawConsentByStaff(playerId, reason)` em `data-rights.ts`, reutilizando `callEraseCascade` (o mesmo apagamento em cascata dos dois fluxos self-service existentes). Botão em `/admin/players`, junto ao "Apagar" já existente.

## Boundaries & Constraints (decididas com o utilizador)

**Always:**
- Apenas `role='admin'` pode executar esta ação.
- Motivo obrigatório (3–500 caracteres), guardado no `audit_logs.payload` como evidência de como o pedido foi recebido.
- Confirmação exige escrever o nome completo exato do jogador (mais rigoroso que o `window.confirm()` do "Apagar" existente) — decisão explícita do utilizador, por se tratar de ação em nome de terceiro.
- Efeito imediato e irreversível, igual ao self-service — sem fila de aprovação (ao contrário da retificação, Art. 21 exige efeito imediato).
- Audit log `subject.withdrew` escrito **antes** do cascade (compliance crítico) — mesma ordem dos dois fluxos existentes.

**Never:**
- Não alterar `withdrawConsent()`/`withdrawConsentByToken()` nem `callEraseCascade()` — reutilizados tal como estão.
- Não construir fila de pendentes/aprovação (ao contrário de `approveRectification`) — não se aplica a uma ação de efeito imediato.

</frozen-after-approval>

## Code Map

- `sparta/src/lib/actions/data-rights.ts:391` — `withdrawConsentByStaff`: valida admin (padrão de `approveRectification`, não `requireAdminRole()`), valida motivo, verifica clube, actualiza `parental_consents`/`profiles` se aplicável, audit log, cascade.
- `sparta/src/app/(staff)/admin/players/RosterPlayersTable.tsx:370` — `WithdrawConsentButton`: painel inline expansível com motivo + confirmação por nome exato.

## Tasks & Acceptance

**Execution:**
- [x] `data-rights.ts` — `withdrawConsentByStaff(playerId, reason)` — espelha `withdrawConsentByToken` na lógica de negócio, `approveRectification` no padrão de verificação de papel
- [x] `RosterPlayersTable.tsx` — `WithdrawConsentButton` junto ao `DeletePlayerButton`
- [x] `data-rights.test.ts` — 5 testes (sucesso, não autenticado, não-admin, motivo curto, jogador de outro clube)
- [x] `roster-players-table-withdraw.test.tsx` — 5 testes (visibilidade do botão, gating do confirm, chamada com motivo, erro do servidor, cancelar)

**Acceptance Criteria:**
- Given um admin em `/admin/players`, when clica "Retirar consentimento" e preenche motivo + nome exato, then `withdrawConsentByStaff` é chamado e o apagamento em cascata é acionado.
- Given o nome escrito não corresponde exactamente, when o admin tenta confirmar, then o botão continua desativado com explicação inline.
- Given um coach/analyst (não-admin), when chama `withdrawConsentByStaff`, then recebe `forbidden`.

## Design Notes

Revisão adversarial (blind + edge-case hunter, dado o risco elevado — apagamento irreversível) encontrou 2 problemas reais corrigidos: guarda `!profile.club_id` contra bypass teórico `null !== null` no isolamento por clube, e guarda `playerName.trim().length > 0` contra bypass trivial do campo de confirmação com nome vazio. Também adicionado feedback inline explicando porque o botão de confirmar está desativado (motivo curto vs. nome não corresponde). Achados adicionais (ausência de guarda de concorrência entre os 3 fluxos de retirada, padrão de verificação de papel duplicado em vez de `requireAdminRole()`, updates sem verificação de erro) são consistentes com o comportamento já estabelecido nos fluxos `withdrawConsent`/`withdrawConsentByToken`/`approveRectification` existentes — ficaram em `deferred-work.md` para não corrigir apenas um dos três fluxos isoladamente.

## Verification

**Commands:**
- `cd sparta && npx vitest run src/__tests__/lib/actions/data-rights.test.ts src/__tests__/app/admin/players/roster-players-table-withdraw.test.tsx` -- expected: 34 testes a passar
- `cd sparta && npm run build` -- expected: compila sem erros
