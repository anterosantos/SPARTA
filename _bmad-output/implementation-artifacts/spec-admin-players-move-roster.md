---
title: 'Mudar jogador de roster no ecrã de Administração'
type: 'feature'
created: '2026-08-04'
status: 'done'
route: 'one-shot'
context: []
---

# Mudar jogador de roster no ecrã de Administração

## Intent

**Problem:** Em `/admin/players`, a coluna "Roster" da tabela era só texto — não havia forma de mudar um jogador de roster sem passar pela base de dados diretamente.

**Approach:** Nova server action `movePlayerToRoster(playerId, fromRosterId, toRosterId)`, seguindo o padrão de soft-delete já usado por `removePlayerFromTeam` (arquiva a linha `roster_players` de origem, activa/insere a de destino). Como o schema permite um jogador estar em vários rosters em simultâneo, a acção só toca na linha do roster específico de onde o jogador está a sair — nunca arquiva outras associações activas. A coluna "Roster" da tabela passa a ser um `<select>` (mesmo padrão do `TeamSelector` já existente).

## Suggested Review Order

- Server action: valida propriedade (jogador e roster de destino no mesmo clube), arquiva só a linha de origem, reactiva/insere a de destino consoante já exista uma linha arquivada para esse par, com rollback se o segundo write falhar.
  [`admin.ts:200`](../../sparta/src/lib/actions/admin.ts#L200)
- `RosterSelector`: `<select>` na tabela, confirmação antes de mudar (avisa que as equipas atribuídas podem deixar de fazer sentido), marca visualmente o roster actual se já não estiver activo.
  [`RosterPlayersTable.tsx:196`](../../sparta/src/app/(staff)/admin/players/RosterPlayersTable.tsx#L196)
- `activeRosters` passado à tabela para preencher as opções do `<select>`.
  [`page.tsx:181`](../../sparta/src/app/(staff)/admin/players/page.tsx#L181)

## Design Notes

A revisão adversarial apanhou um bug real na primeira versão: arquivava *todas* as linhas activas de `roster_players` do jogador em vez de só a do roster de origem — partia a associação a qualquer outro roster em que o jogador estivesse legitimamente. Corrigido para `movePlayerToRoster` receber `fromRosterId` explícito e só tocar nessa linha específica. Também adicionado rollback (reactivar a linha de origem) se o write da linha de destino falhar depois do arquivamento ter sido feito.

Sem testes automatizados — `admin.ts` não tem infraestrutura de testes unitários pré-existente (só um teste de integração que precisa de Supabase real); ver `deferred-work.md`.

## Verification

**Commands:**
- `cd sparta && npm run build` -- expected: compila sem erros

**Manual checks (if no CLI):**
- Em `/admin/players`, mudar o roster de um jogador via `<select>`, confirmar o aviso, e verificar que a linha se move para a secção correta após o refresh.
