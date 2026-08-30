-- Migration: 000400_match_minutes_played_stints
-- Purpose: match_minutes_played (000275) só lia match_lineups.started_minute/
-- ended_minute — um único par, correcto apenas para jogadores com uma entrada e
-- (no máximo) uma saída. Com substituições volantes (jogador que sai volta a
-- role='bench' para poder voltar a entrar — ver 000399), essa view deixava de
-- contar qualquer jogador actualmente no banco, mesmo tendo já jogado minutos.
--
-- Passa a somar todos os períodos em match_lineup_stints por jogador/sessão.
--
-- IMPORTANTE: CREATE OR REPLACE VIEW não permite remover/reordenar colunas de uma
-- view existente (erro "cannot drop columns from view"). v_athlete_stats_per_season
-- (000325) depende desta view, por isso mantém-se exactamente a mesma lista de
-- colunas/ordem/tipos de 000275 (session_id, player_id, duration_min,
-- started_minute, ended_minute, minutes_played) — started_minute/ended_minute
-- passam a ser o primeiro/último período (MIN/MAX), só minutes_played muda de
-- cálculo (soma de todos os períodos em vez de um único par).

CREATE OR REPLACE VIEW match_minutes_played AS
SELECT
  mls.session_id,
  mls.player_id,
  s.duration_min,
  MIN(mls.started_minute) AS started_minute,
  MAX(mls.ended_minute) AS ended_minute,
  SUM(
    COALESCE(mls.ended_minute, s.duration_min) - mls.started_minute
  )::int AS minutes_played
FROM match_lineup_stints mls
JOIN sessions s ON s.id = mls.session_id
GROUP BY mls.session_id, mls.player_id, s.duration_min;

COMMENT ON VIEW match_minutes_played IS
  'Minutos jogados por jogador por sessão — minutes_played soma todos os períodos '
  'em campo (match_lineup_stints), correcto mesmo com substituições volantes '
  'múltiplas. started_minute/ended_minute mostram o primeiro/último período, só '
  'para referência (mantidos por v_athlete_stats_per_season depender desta view).';

GRANT SELECT ON match_minutes_played TO authenticated;
GRANT SELECT ON match_minutes_played TO service_role;
