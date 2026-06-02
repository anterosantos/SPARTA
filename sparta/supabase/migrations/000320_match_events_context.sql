-- Migration: 000320_match_events_context
-- Purpose: Sprint 1.5 — Expandir match_events com novos tipos de ação e contexto JSONB
--   Novos event types: goal, card, corner, entry_opp_area, entry_own_area, match_time_record
--   context JSONB: dados extra condicionais (play_type, period, infraction_type, etc.)
-- Stories: T1.5.10, T1.5.11

-- Remover constraint de action existente e substituir com lista expandida
ALTER TABLE match_events
  DROP CONSTRAINT IF EXISTS match_events_action_check;

ALTER TABLE match_events
  ADD CONSTRAINT match_events_action_check CHECK (action IN (
    -- Ações originais (Story 6.1)
    'ball_loss',
    'ball_recovery',
    'shot_total',
    'shot_on_target',
    'pass_completed',
    'def_pressure',
    'def_action_success',
    'off_action_success',
    -- Novos tipos Sprint 1.5 (FR27a, FR27b, FR27c, FR27d, FR31a)
    'goal',
    'card',
    'corner',
    'entry_opp_area',
    'entry_own_area',
    'match_time_record'
  ));

-- Coluna context para dados condicionais
ALTER TABLE match_events
  ADD COLUMN IF NOT EXISTS context jsonb NULL;

COMMENT ON COLUMN match_events.context IS
  'Dados contextuais condicionais por tipo de evento. '
  'Para goal: {play_type: "corner"|"open_play"|"free_kick"|"other", period: 1|2, minute: int}. '
  'Para card: {card_type: "yellow"|"red", infraction_type: "verbal"|"foul", period: 1|2}. '
  'Para match_time_record: {total_minutes: int, useful_minutes: int}. '
  'NULL para ações sem contexto adicional.';

-- Índice GIN para queries em context JSONB
CREATE INDEX IF NOT EXISTS idx_match_events_context_gin
  ON match_events USING GIN (context)
  WHERE context IS NOT NULL;
