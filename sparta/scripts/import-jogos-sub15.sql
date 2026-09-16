-- ─────────────────────────────────────────────────────────────────────────────
-- Importa o calendário de jogos "II Divisão Sub-15 I Fase Série C 26/27"
-- (fonte: página h2h fornecida pelo utilizador) como sessões type='match'.
--
-- Parâmetros (bloco `params`, repetido no PASSO 1 e no PASSO 2 — editar os dois
-- se mudarem): equipa "Iniciados U15", kickoff 11:00, duração 80 min, jogos em
-- casa no Complexo Desportivo do Real SC campo nº2, jogos fora com location NULL.
-- `is_home` fica true/false consoante a coluna `home_away` (C/F) de cada jogo —
-- é o que o calendário usa para mostrar "vs Adversário (C)"/"(F)".
--
-- Como correr:
--   1. PASSO 1 (SELECT) — confirma que team_id/club_id/season_id/created_by
--      resolvem para valores não-nulos e que as datas/horas estão certas.
--      Se `team` não resolver (0 ou >1 linhas), a query falha com erro —
--      ajusta team_name_pattern e repete.
--   2. PASSO 2 (transação) — revê o RETURNING; depois `COMMIT;` ou `ROLLBACK;`.
--
-- Idempotente: um jogo já existente (mesma equipa/adversário/data) não é
-- duplicado numa 2ª execução.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ PASSO 1 — PRÉ-VISUALIZAÇÃO (só leitura) ═════════════════════════════════
WITH params AS (
  SELECT
    'Iniciados U15'::text                       AS team_name_pattern,
    time '11:00'                                 AS kickoff,
    80                                            AS duration_min,
    'Complexo Desportivo do Real SC campo nº2'::text AS home_location
),
team AS (
  SELECT t.id AS team_id, r.club_id
  FROM teams t
  JOIN rosters r ON r.id = t.roster_id
  WHERE t.name ILIKE '%' || (SELECT team_name_pattern FROM params) || '%'
    AND t.is_archived = false
),
season AS (
  SELECT id AS season_id FROM seasons
  WHERE club_id = (SELECT club_id FROM team) AND is_current = true
),
coach AS (
  SELECT id AS profile_id FROM profiles
  WHERE club_id = (SELECT club_id FROM team) AND role = 'coach'
  ORDER BY created_at LIMIT 1
),
games(jornada, match_date, home_away, opponent) AS (
  VALUES
    ('J1',  date '2026-09-27', 'C', 'O Elvas'),
    ('J2',  date '2026-10-04', 'F', 'UD Leiria'),
    ('J3',  date '2026-10-11', 'C', 'Torreense'),
    ('J4',  date '2026-10-18', 'F', 'Sporting B'),
    ('J5',  date '2026-10-25', 'F', 'Caldas SC'),
    ('J6',  date '2026-11-01', 'C', 'Leiria e Marrazes'),
    ('J7',  date '2026-11-08', 'F', 'Amiense'),
    ('J8',  date '2026-11-15', 'C', 'Monfortense'),
    ('J9',  date '2026-11-22', 'F', 'Marinhense'),
    ('J10', date '2026-11-29', 'C', 'Sacavenense'),
    ('J11', date '2026-12-05', 'F', 'Marítimo')
)
SELECT
  g.jornada,
  g.match_date,
  g.home_away,
  g.opponent,
  ((g.match_date + (SELECT kickoff FROM params)) AT TIME ZONE 'Europe/Lisbon') AS scheduled_at_utc,
  CASE WHEN g.home_away = 'C' THEN (SELECT home_location FROM params) END      AS location,
  (g.home_away = 'C')            AS is_home,
  (SELECT team_id FROM team)     AS team_id_resolvido,
  (SELECT club_id FROM team)     AS club_id_resolvido,
  (SELECT season_id FROM season) AS season_id_resolvido,
  (SELECT profile_id FROM coach) AS created_by_resolvido,
  EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.club_id = (SELECT club_id FROM team)
      AND s.type = 'match'
      AND s.opponent_name = g.opponent
      AND (s.scheduled_at AT TIME ZONE 'Europe/Lisbon')::date = g.match_date
  ) AS ja_existe
FROM games g
ORDER BY g.match_date;


-- ═══ PASSO 2 — APLICAÇÃO (em transação; termina em COMMIT ou ROLLBACK) ═══════
BEGIN;

WITH params AS (
  SELECT
    'Iniciados U15'::text                       AS team_name_pattern,
    time '11:00'                                 AS kickoff,
    80                                            AS duration_min,
    'Complexo Desportivo do Real SC campo nº2'::text AS home_location
),
team AS (
  SELECT t.id AS team_id, r.club_id
  FROM teams t
  JOIN rosters r ON r.id = t.roster_id
  WHERE t.name ILIKE '%' || (SELECT team_name_pattern FROM params) || '%'
    AND t.is_archived = false
),
season AS (
  SELECT id AS season_id FROM seasons
  WHERE club_id = (SELECT club_id FROM team) AND is_current = true
),
coach AS (
  SELECT id AS profile_id FROM profiles
  WHERE club_id = (SELECT club_id FROM team) AND role = 'coach'
  ORDER BY created_at LIMIT 1
),
games(jornada, match_date, home_away, opponent) AS (
  VALUES
    ('J1',  date '2026-09-27', 'C', 'O Elvas'),
    ('J2',  date '2026-10-04', 'F', 'UD Leiria'),
    ('J3',  date '2026-10-11', 'C', 'Torreense'),
    ('J4',  date '2026-10-18', 'F', 'Sporting B'),
    ('J5',  date '2026-10-25', 'F', 'Caldas SC'),
    ('J6',  date '2026-11-01', 'C', 'Leiria e Marrazes'),
    ('J7',  date '2026-11-08', 'F', 'Amiense'),
    ('J8',  date '2026-11-15', 'C', 'Monfortense'),
    ('J9',  date '2026-11-22', 'F', 'Marinhense'),
    ('J10', date '2026-11-29', 'C', 'Sacavenense'),
    ('J11', date '2026-12-05', 'F', 'Marítimo')
),
to_insert AS (
  SELECT
    (SELECT club_id FROM team)     AS club_id,
    (SELECT season_id FROM season) AS season_id,
    'match'::text                  AS type,
    ((g.match_date + (SELECT kickoff FROM params)) AT TIME ZONE 'Europe/Lisbon') AS scheduled_at,
    (SELECT duration_min FROM params) AS duration_min,
    CASE WHEN g.home_away = 'C' THEN (SELECT home_location FROM params) END AS location,
    g.opponent AS opponent_name,
    (g.home_away = 'C') AS is_home,
    (SELECT profile_id FROM coach) AS created_by
  FROM games g
  WHERE NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.club_id = (SELECT club_id FROM team)
      AND s.type = 'match'
      AND s.opponent_name = g.opponent
      AND (s.scheduled_at AT TIME ZONE 'Europe/Lisbon')::date = g.match_date
  )
),
inserted_sessions AS (
  INSERT INTO sessions (club_id, season_id, type, scheduled_at, duration_min, location, opponent_name, is_home, created_by)
  SELECT club_id, season_id, type, scheduled_at, duration_min, location, opponent_name, is_home, created_by
  FROM to_insert
  RETURNING id, scheduled_at, opponent_name, location
)
INSERT INTO session_teams (session_id, team_id)
SELECT i.id, (SELECT team_id FROM team)
FROM inserted_sessions i
RETURNING
  session_id,
  (SELECT opponent_name FROM inserted_sessions WHERE id = session_id) AS opponent_name,
  (SELECT scheduled_at   FROM inserted_sessions WHERE id = session_id) AS scheduled_at_utc,
  ((SELECT scheduled_at FROM inserted_sessions WHERE id = session_id) AT TIME ZONE 'Europe/Lisbon') AS hora_lisboa;

-- Revê o RETURNING acima (deve listar os jogos que faltavam, com hora certa).
-- Depois executa uma das duas:
--   COMMIT;
--   ROLLBACK;
ROLLBACK;
