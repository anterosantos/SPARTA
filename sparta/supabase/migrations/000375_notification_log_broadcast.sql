-- Migration: 000375_notification_log_broadcast
-- Purpose: Suporte a push notifications de broadcast (mensagens do treinador)
--
-- 1. session_id passa a nullable — broadcasts não têm sessão associada
-- 2. broadcast_id uuid nullable — FK para broadcasts, presente em kind='broadcast'
-- 3. Adicionar 'broadcast' ao CHECK constraint de kind
-- 4. Substituir o UNIQUE constraint antigo por índices parciais:
--    - sessões: UNIQUE (profile_id, session_id, kind) WHERE session_id IS NOT NULL
--    - broadcasts: UNIQUE (profile_id, broadcast_id) WHERE broadcast_id IS NOT NULL

-- =============================================================================
-- 1. session_id nullable
-- =============================================================================

ALTER TABLE notification_log
  ALTER COLUMN session_id DROP NOT NULL;

-- =============================================================================
-- 2. broadcast_id
-- =============================================================================

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS broadcast_id uuid
    REFERENCES broadcasts(id) ON DELETE CASCADE;

COMMENT ON COLUMN notification_log.broadcast_id IS
  'Para kind=broadcast: referência à mensagem de broadcast. NULL para todos os outros kinds.';

-- =============================================================================
-- 3. Adicionar 'broadcast' ao kind CHECK
-- =============================================================================

ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_kind_check;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_kind_check
  CHECK (kind IN ('fatigue_pre', 'fatigue_post', 'player_absence', 'convocado', 'broadcast'));

-- =============================================================================
-- 4. Substituir UNIQUE constraint por índices parciais
-- =============================================================================
-- O constraint antigo não suportava session_id nullable porque NULL ≠ NULL em UNIQUE.

ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_unique_session_kind;

-- Sessões (session_id NOT NULL): um push por (profile, sessão, kind)
CREATE UNIQUE INDEX IF NOT EXISTS notification_log_session_kind_unique
  ON notification_log (profile_id, session_id, kind)
  WHERE session_id IS NOT NULL;

-- Broadcasts (broadcast_id NOT NULL): um push por (profile, broadcast)
CREATE UNIQUE INDEX IF NOT EXISTS notification_log_broadcast_unique
  ON notification_log (profile_id, broadcast_id)
  WHERE broadcast_id IS NOT NULL;
