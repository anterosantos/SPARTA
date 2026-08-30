-- Migration: 000402_match_events_half_time
-- Purpose: Novo tipo de evento "half_time" — marcador de fim da 1ª parte /
-- início da 2ª parte no registo de eventos do jogo. Sem jogador nem zona
-- reais associados (player_id já é NULLABLE desde 000270 — sem alteração
-- de schema necessária para o suportar).

ALTER TABLE match_events
  DROP CONSTRAINT IF EXISTS match_events_action_check;

ALTER TABLE match_events
  ADD CONSTRAINT match_events_action_check CHECK (action IN (
    'ball_loss',
    'ball_recovery',
    'shot_total',
    'shot_on_target',
    'pass_completed',
    'def_pressure',
    'def_action_success',
    'off_action_success',
    'goal',
    'card',
    'corner',
    'entry_opp_area',
    'entry_own_area',
    'match_time_record',
    'half_time'
  ));
