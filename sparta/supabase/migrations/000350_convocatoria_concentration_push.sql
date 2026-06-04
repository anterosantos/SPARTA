-- Migration: 000350_convocatoria_concentration_push
-- Purpose: Hora de concentração na convocatória + push notifications para convocados
--
-- 1. Adicionar concentration_time (HH:MM) à tabela sessions
-- 2. Adicionar kind 'convocado' ao CHECK constraint de notification_log

-- =============================================================================
-- 1. Hora de concentração
-- =============================================================================
-- Texto livre "HH:MM" definido pelo treinador na página de convocatória.
-- Apenas display — não implica timezone.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS concentration_time text;

COMMENT ON COLUMN sessions.concentration_time IS
  'Hora de concentração para jogos/amigáveis (ex: "14:30"). Definida pelo treinador na convocatória. Apenas jogos/amigáveis.';

-- =============================================================================
-- 2. kind "convocado" em notification_log
-- =============================================================================
-- Expandir o CHECK constraint para incluir o novo tipo de notificação.
-- A Edge Function send-push já trata player_absence; o novo caso convocado
-- seguirá a mesma estrutura (session_id disponível na linha).

ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_kind_check;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_kind_check
  CHECK (kind IN ('fatigue_pre', 'fatigue_post', 'player_absence', 'convocado'));

COMMENT ON COLUMN notification_log.kind IS
  'fatigue_pre = X min antes da sessão; fatigue_post = Y min após; '
  'player_absence = treinador notificado de ausência declarada; '
  'convocado = jogador notificado de convocatória enviada pelo treinador.';
