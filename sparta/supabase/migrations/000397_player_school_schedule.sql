-- Migration: 000397_player_school_schedule
-- Purpose: Horário semanal de saída da escola por jogador + intervalos de datas em que é válido
--          (período letivo). Usado para calcular risco de atraso na Prontidão
--          (saída + 60min de deslocação fixa vs início da sessão).
-- Spec: _bmad-output/implementation-artifacts/spec-horario-saida-risco-atraso.md
-- RGPD: não é dado de saúde — não sujeito a auditedRead()/no-direct-health-data-read.

-- =============================================================================
-- player_school_schedule — horário semanal (Seg-Sex), um row por jogador
-- =============================================================================

CREATE TABLE player_school_schedule (
  id             uuid        NOT NULL DEFAULT uuidv7(),
  club_id        uuid        NOT NULL REFERENCES clubs(id)   ON DELETE CASCADE,
  player_id      uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  mon_time       time            NULL,
  tue_time       time            NULL,
  wed_time       time            NULL,
  thu_time       time            NULL,
  fri_time       time            NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT player_school_schedule_pkey PRIMARY KEY (id),
  CONSTRAINT player_school_schedule_player_unique UNIQUE (player_id)
);

CREATE INDEX idx_player_school_schedule_club
  ON player_school_schedule(club_id);

COMMENT ON TABLE player_school_schedule IS
  'Horário semanal (Seg-Sex) de saída da escola por jogador. Usado para calcular risco de atraso na Prontidão. Não é dado de saúde.';

COMMENT ON COLUMN player_school_schedule.mon_time IS
  'Hora de saída da escola à Segunda-feira. NULL = sem aulas / não aplicável nesse dia.';

-- =============================================================================
-- player_school_terms — intervalos de datas (período letivo) em que o horário é válido
-- =============================================================================

CREATE TABLE player_school_terms (
  id             uuid        NOT NULL DEFAULT uuidv7(),
  club_id        uuid        NOT NULL REFERENCES clubs(id)   ON DELETE CASCADE,
  player_id      uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  start_date     date        NOT NULL,
  end_date       date        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT player_school_terms_pkey PRIMARY KEY (id),
  CONSTRAINT player_school_terms_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX idx_player_school_terms_player_dates
  ON player_school_terms(player_id, start_date, end_date);

CREATE INDEX idx_player_school_terms_club
  ON player_school_terms(club_id);

COMMENT ON TABLE player_school_terms IS
  'Intervalos de datas (período letivo) em que o horário semanal de player_school_schedule é válido para calcular risco de atraso.';

-- =============================================================================
-- Row Level Security — mirror de fatigue_responses (000200)
-- =============================================================================

ALTER TABLE player_school_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_school_terms    ENABLE ROW LEVEL SECURITY;

-- ── player_school_schedule ──────────────────────────────────────────────────

-- Jogador vê o seu próprio horário
CREATE POLICY "player_sees_own" ON player_school_schedule
  FOR SELECT USING (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  );

-- Jogador cria o seu próprio horário no seu clube
CREATE POLICY "player_inserts_own" ON player_school_schedule
  FOR INSERT WITH CHECK (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
    AND club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Jogador edita o seu próprio horário (editável depois de preenchido)
CREATE POLICY "player_updates_own" ON player_school_schedule
  FOR UPDATE USING (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  ) WITH CHECK (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  );

-- Staff (coach/analyst) apenas lê, dentro do seu clube
CREATE POLICY "staff_reads_club" ON player_school_schedule
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = player_school_schedule.club_id
    )
  );

-- ── player_school_terms ─────────────────────────────────────────────────────

-- Jogador vê os seus próprios intervalos letivos
CREATE POLICY "player_sees_own" ON player_school_terms
  FOR SELECT USING (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  );

-- Jogador cria os seus próprios intervalos letivos no seu clube
CREATE POLICY "player_inserts_own" ON player_school_terms
  FOR INSERT WITH CHECK (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
    AND club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Jogador remove os seus próprios intervalos letivos (substituição via delete+insert)
CREATE POLICY "player_deletes_own" ON player_school_terms
  FOR DELETE USING (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  );

-- Staff (coach/analyst) apenas lê, dentro do seu clube
CREATE POLICY "staff_reads_club" ON player_school_terms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = player_school_terms.club_id
    )
  );

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON player_school_schedule TO authenticated;
GRANT SELECT, INSERT, DELETE ON player_school_terms TO authenticated;
