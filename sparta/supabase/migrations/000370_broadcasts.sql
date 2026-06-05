-- Migration: 000370_broadcasts
-- Purpose: Mensagens de broadcast do treinador para todos os jogadores do clube
--
-- broadcasts        — mensagens enviadas pelo treinador
-- broadcast_dismissals — registo de dispensas por jogador

-- =============================================================================
-- 1. Tabela broadcasts
-- =============================================================================

CREATE TABLE broadcasts (
  id         uuid        NOT NULL DEFAULT public.uuidv7(),
  club_id    uuid        NOT NULL REFERENCES clubs(id)    ON DELETE CASCADE,
  coach_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message    text        NOT NULL CHECK (length(trim(message)) > 0 AND length(message) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT broadcasts_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE broadcasts IS
  'Mensagens de broadcast enviadas pelo treinador para todos os jogadores do clube. '
  'Ficam visíveis no inbox do ecrã "Hoje" até o jogador dispensar ou a mensagem '
  'ter mais de 30 dias.';

CREATE INDEX idx_broadcasts_club ON broadcasts(club_id, created_at DESC);

-- =============================================================================
-- 2. RLS — broadcasts
-- =============================================================================

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- Qualquer membro do clube pode ler as mensagens do seu clube
CREATE POLICY "broadcasts_club_read" ON broadcasts
  FOR SELECT TO authenticated
  USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Apenas treinadores podem enviar mensagens
CREATE POLICY "broadcasts_coach_insert" ON broadcasts
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'coach'
    AND coach_id = auth.uid()
  );

-- =============================================================================
-- 3. Tabela broadcast_dismissals
-- =============================================================================

CREATE TABLE broadcast_dismissals (
  profile_id   uuid        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  broadcast_id uuid        NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT broadcast_dismissals_pkey PRIMARY KEY (profile_id, broadcast_id)
);

CREATE INDEX idx_broadcast_dismissals_profile
  ON broadcast_dismissals(profile_id);

-- =============================================================================
-- 4. RLS — broadcast_dismissals
-- =============================================================================

ALTER TABLE broadcast_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcast_dismissals_own" ON broadcast_dismissals
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
