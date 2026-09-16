-- Migration: 000403_sessions_is_home
-- Purpose: Casa/fora para jogos e amigáveis — mostrar no calendário
-- "vs Adversário (C)"/"(F)" em vez de só "Jogo".

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS is_home boolean;

COMMENT ON COLUMN sessions.is_home IS
  'true = jogo em casa, false = fora, NULL = não aplicável (treino/palestra/etc.) '
  'ou não definido. Definido pelo treinador na criação/edição de jogos e amigáveis.';
