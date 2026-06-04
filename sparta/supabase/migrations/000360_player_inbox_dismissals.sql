-- Migration: 000360_player_inbox_dismissals
-- Purpose: Permitir ao jogador dispensar notificações do inbox "Hoje"
--
-- Um jogador pode remover manualmente uma notificação do seu inbox. Sem este
-- registo, as notificações desaparecem apenas quando a sessão passa (filtro
-- automático). Com este registo, o jogador pode removê-las antecipadamente.
--
-- PK composta (profile_id, session_id, kind) garante idempotência — dismiss
-- repetido não cria duplicados.

CREATE TABLE player_inbox_dismissals (
  profile_id   uuid NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  kind         text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT player_inbox_dismissals_pkey
    PRIMARY KEY (profile_id, session_id, kind)
);

COMMENT ON TABLE player_inbox_dismissals IS
  'Registo de notificações dispensadas pelo jogador no ecrã "Hoje". '
  'A notificação deixa de aparecer até o jogador limpar o registo ou a sessão passar.';

-- Índice para lookup rápido por profile (getPlayerNotifications filtra por profile_id + kind)
CREATE INDEX idx_player_inbox_dismissals_profile
  ON player_inbox_dismissals(profile_id, kind);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE player_inbox_dismissals ENABLE ROW LEVEL SECURITY;

-- Cada jogador só vê e gere as suas próprias dispensas
CREATE POLICY "player_inbox_dismissals_own" ON player_inbox_dismissals
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
