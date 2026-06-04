-- Migration: 000345_notification_log_player_absence
-- Purpose: Suporte a notificação de ausência declarada pelo jogador (FR60, Story 4.9)
--
--   1. Adicionar 'player_absence' ao CHECK constraint de notification_log.kind
--   2. Adicionar context_player_id — referência ao jogador que declarou ausência,
--      usado pelo send-push Edge Function para construir o payload da notificação

-- 1. Expandir o CHECK constraint de kind
ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_kind_check;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_kind_check
  CHECK (kind IN ('fatigue_pre', 'fatigue_post', 'player_absence'));

-- 2. Coluna para o jogador que originou a notificação (player_absence only)
ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS context_player_id uuid
    REFERENCES players(id) ON DELETE SET NULL;

COMMENT ON COLUMN notification_log.context_player_id IS
  'Para kind=player_absence: ID do jogador que declarou ausência. '
  'Usado pelo Edge Function send-push para incluir o primeiro nome do jogador no payload. '
  'NULL para fatigue_pre e fatigue_post.';
