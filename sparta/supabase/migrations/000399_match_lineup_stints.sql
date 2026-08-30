-- Migration: 000399_match_lineup_stints
-- Purpose: Histórico de períodos em campo por jogador — necessário para substituições
-- volantes (um jogador pode sair e voltar a entrar várias vezes no mesmo jogo).
--
-- match_lineups.started_minute/ended_minute só guardam UM par (o mais recente), o que
-- é suficiente para saber se um jogador está em campo agora, mas não para somar os
-- minutos jogados ao longo de múltiplas entradas/saídas. match_lineup_stints regista
-- cada período separadamente, para poder somar correctamente.

CREATE TABLE match_lineup_stints (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  started_minute int NOT NULL DEFAULT 0,
  ended_minute int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Performance: encontrar o período em aberto de um jogador (ended_minute IS NULL) ao
-- registar uma substituição, e listar todos os períodos de uma sessão para o resumo.
CREATE INDEX idx_match_lineup_stints_session_player
  ON match_lineup_stints(session_id, player_id);

CREATE INDEX idx_match_lineup_stints_open
  ON match_lineup_stints(session_id, player_id)
  WHERE ended_minute IS NULL;

CREATE TRIGGER match_lineup_stints_updated_at
  BEFORE UPDATE ON match_lineup_stints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE match_lineup_stints ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de isolamento de match_lineups (000130): sem club_id directo, isolamento
-- via session_id → sessions.club_id.
CREATE POLICY "match_lineup_stints_select_club_isolation" ON match_lineup_stints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('coach', 'analyst')
    )
  );

CREATE POLICY "match_lineup_stints_insert_staff" ON match_lineup_stints
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('coach', 'analyst')
    )
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "match_lineup_stints_update_staff" ON match_lineup_stints
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('coach', 'analyst')
    )
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('coach', 'analyst')
    )
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "service_role_all_match_lineup_stints" ON match_lineup_stints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON TABLE match_lineup_stints TO authenticated;
GRANT ALL ON TABLE match_lineup_stints TO service_role;

COMMENT ON TABLE match_lineup_stints IS
  'Um período contínuo em campo por jogador/sessão. Um jogador com substituições '
  'volantes (sai e volta a entrar) tem várias linhas — minutos jogados = soma de '
  '(ended_minute - started_minute) de todas as linhas.';
