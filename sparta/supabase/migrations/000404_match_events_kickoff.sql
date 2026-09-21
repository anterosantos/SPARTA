-- Migration: 000404_match_events_kickoff
-- Purpose: Separar o marcador único "half_time" (fim da 1ª parte / início da
-- 2ª parte) em dois eventos distintos, e acrescentar o marcador de início de
-- jogo — para o cronómetro em directo da captura de eventos.
--
-- "half_time" mantém-se (dados históricos continuam válidos) e passa a
-- significar apenas "fim da 1ª parte" — ver relabel em
-- src/lib/schemas/match-events.ts. player_id/zone já são NULLABLE/sem
-- significado real desde 000270/000402 — sem alteração de schema necessária.

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
    'half_time',
    'match_start',
    'second_half_start'
  ));
