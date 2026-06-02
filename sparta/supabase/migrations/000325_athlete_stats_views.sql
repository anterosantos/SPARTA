-- Migration: 000325_athlete_stats_views
-- Purpose: Sprint 1.5 — Views para estatísticas de atleta e clean sheets (T1.5.2)
--   v_athlete_stats_per_season: % convocatórias e % minutos por atleta por época
--   v_clean_sheets: minutos sem sofrer golos por jogo

-- =============================================================================
-- v_athlete_stats_per_season
-- % convocatórias (épocas/carreira) e % minutos (épocas/carreira) por jogador
-- FR31a: Sistema calcula automaticamente % convocatórias e % minutos por atleta
-- =============================================================================

CREATE OR REPLACE VIEW v_athlete_stats_per_season AS
WITH season_sessions AS (
  -- Total de sessões de jogo/amigável por época e clube
  SELECT
    s.season_id,
    s.club_id,
    COUNT(*) AS total_match_sessions
  FROM sessions s
  WHERE s.type IN ('match', 'friendly')
    AND s.status = 'completed'
  GROUP BY s.season_id, s.club_id
),
player_convocacoes AS (
  -- Convocatórias por jogador e época
  SELECT
    p.id AS player_id,
    p.club_id,
    s.season_id,
    COUNT(DISTINCT ml.session_id) AS convocacoes
  FROM players p
  JOIN sessions s ON s.club_id = p.club_id
  JOIN match_lineups ml ON ml.session_id = s.id AND ml.player_id = p.id
  WHERE s.type IN ('match', 'friendly')
    AND s.status = 'completed'
  GROUP BY p.id, p.club_id, s.season_id
),
player_minutes AS (
  -- Minutos jogados por jogador e época via match_minutes_played view
  SELECT
    mmp.player_id,
    s.season_id,
    SUM(mmp.minutes_played) AS total_minutes
  FROM match_minutes_played mmp
  JOIN sessions s ON s.id = mmp.session_id
  WHERE s.status = 'completed'
  GROUP BY mmp.player_id, s.season_id
),
season_total_minutes AS (
  -- Total de minutos possíveis por época (nº sessões × duração média)
  SELECT
    s.season_id,
    s.club_id,
    COALESCE(SUM(s.duration_min), 0)::int AS total_available_minutes
  FROM sessions s
  WHERE s.type IN ('match', 'friendly')
    AND s.status = 'completed'
  GROUP BY s.season_id, s.club_id
)
SELECT
  p.id AS player_id,
  p.club_id,
  se.id AS season_id,
  se.name AS season_name,
  COALESCE(pc.convocacoes, 0) AS convocacoes,
  COALESCE(ss.total_match_sessions, 0) AS total_match_sessions,
  CASE
    WHEN COALESCE(ss.total_match_sessions, 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(pc.convocacoes, 0)::numeric / ss.total_match_sessions) * 100, 1
    )
  END AS pct_convocacoes,
  COALESCE(pm.total_minutes, 0) AS minutes_played,
  COALESCE(stm.total_available_minutes, 0) AS total_available_minutes,
  CASE
    WHEN COALESCE(stm.total_available_minutes, 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(pm.total_minutes, 0)::numeric / stm.total_available_minutes) * 100, 1
    )
  END AS pct_minutes
FROM players p
CROSS JOIN seasons se
LEFT JOIN season_sessions ss ON ss.season_id = se.id AND ss.club_id = p.club_id
LEFT JOIN player_convocacoes pc ON pc.player_id = p.id AND pc.season_id = se.id
LEFT JOIN player_minutes pm ON pm.player_id = p.id AND pm.season_id = se.id
LEFT JOIN season_total_minutes stm ON stm.season_id = se.id AND stm.club_id = p.club_id
WHERE p.is_archived = false
  AND se.club_id = p.club_id;

COMMENT ON VIEW v_athlete_stats_per_season IS
  'Estatísticas por atleta e época: % convocatórias e % minutos jogados (FR31a).';

-- =============================================================================
-- v_clean_sheets
-- Análise de golos: minutos sem sofrer golos por jogo (FR27c)
-- =============================================================================

CREATE OR REPLACE VIEW v_clean_sheets AS
WITH goals_conceded AS (
  -- Golos sofridos (própria baliza): event type='goal', não há player_id de equipa adversária
  -- A lógica: golos registados sem player_id ou com team_goal flag no context
  SELECT
    me.session_id,
    me.club_id,
    COUNT(*) AS goals_conceded,
    MIN(
      CASE
        WHEN me.context->>'period' = '1' THEN
          COALESCE((me.context->>'minute')::int, 45)
        ELSE NULL
      END
    ) AS first_goal_conceded_minute
  FROM match_events me
  WHERE me.action = 'goal'
    AND me.is_deleted = false
    AND (me.context->>'team' = 'opponent' OR me.player_id IS NULL)
  GROUP BY me.session_id, me.club_id
)
SELECT
  s.id AS session_id,
  s.club_id,
  s.season_id,
  s.scheduled_at::date AS match_date,
  s.duration_min,
  COALESCE(gc.goals_conceded, 0) AS goals_conceded,
  CASE
    WHEN COALESCE(gc.goals_conceded, 0) = 0 THEN s.duration_min
    ELSE COALESCE(gc.first_goal_conceded_minute, s.duration_min)
  END AS clean_sheet_minutes,
  CASE
    WHEN COALESCE(gc.goals_conceded, 0) = 0 THEN true
    ELSE false
  END AS is_clean_sheet
FROM sessions s
LEFT JOIN goals_conceded gc ON gc.session_id = s.id
WHERE s.type IN ('match', 'friendly')
  AND s.status = 'completed';

COMMENT ON VIEW v_clean_sheets IS
  'Clean sheets por jogo: minutos sem sofrer golos (FR27c). '
  'is_clean_sheet=true quando goals_conceded=0.';

-- GRANTs para views
GRANT SELECT ON v_athlete_stats_per_season TO authenticated;
GRANT SELECT ON v_clean_sheets TO authenticated;
