-- Migration: 000380_fix_notification_log_constraints
-- Purpose: Corrigir constraints de notification_log para suportar broadcasts
--
-- Problema: partial unique INDEXES (criados em 000375) não funcionam com PostgREST
-- upsert — o ON CONFLICT (cols) não resolve partial indexes, apenas constraints.
--
-- Solução:
--   1. Remover os partial indexes da migration 000375
--   2. Re-adicionar UNIQUE CONSTRAINT (profile_id, session_id, kind)
--      → NULLs são DISTINTOS em PostgreSQL UNIQUE, por isso:
--        - Notificações de sessão (session_id NOT NULL): únicas por (profile, sessão, kind)
--        - Broadcasts (session_id NULL): cada NULL é distinto → múltiplos broadcasts
--          para o mesmo jogador são permitidos (comportamento correcto)
--   3. Adicionar UNIQUE CONSTRAINT (profile_id, broadcast_id)
--      → rows com broadcast_id=NULL (todas as não-broadcast) não conflituam entre si
--      → rows com mesmo (profile_id, broadcast_id) não-null → conflito → idempotência

-- =============================================================================
-- 1. Remover partial indexes (incompatíveis com PostgREST upsert)
-- =============================================================================

DROP INDEX IF EXISTS notification_log_session_kind_unique;
DROP INDEX IF EXISTS notification_log_broadcast_unique;

-- =============================================================================
-- 2. UNIQUE CONSTRAINT para notificações de sessão
-- =============================================================================

ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_unique_session_kind;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_session_kind_unique
  UNIQUE (profile_id, session_id, kind);

-- =============================================================================
-- 3. UNIQUE CONSTRAINT para broadcasts (idempotência por jogador×broadcast)
-- =============================================================================

ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_broadcast_unique;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_broadcast_unique
  UNIQUE (profile_id, broadcast_id);
