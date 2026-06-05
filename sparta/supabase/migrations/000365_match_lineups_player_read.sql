-- Migration: 000365_match_lineups_player_read
-- Purpose: Permitir ao jogador ler as suas próprias entradas em match_lineups
--
-- Contexto: a policy existente "match_lineups_select_club_isolation" restringe
-- leitura a coach/analyst. Jogadores com role='player' ficavam bloqueados, o que
-- impedia getPlayerNotifications() (que usa o JWT do jogador) de encontrar as
-- suas convocatórias para mostrar no inbox do ecrã "Hoje".
--
-- Esta policy é aditiva — não altera as permissões de staff.
-- O jogador só vê as linhas onde é o próprio (player_id = id do seu registo).
-- role (titular/suplente) não é exposto na UI de notificações (design decision).

CREATE POLICY "match_lineups_player_own_read" ON match_lineups
  FOR SELECT
  TO authenticated
  USING (
    player_id = (
      SELECT id FROM players
      WHERE profile_id = auth.uid()
      LIMIT 1
    )
  );
