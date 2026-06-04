-- Migration: 000355_sessions_opponent
-- Purpose: Nome do adversário para jogos/amigáveis
--
-- Usado na convocatória para incluir "vs Adversário" na notificação push
-- e para mostrar no ecrã da sessão.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS opponent_name text;

COMMENT ON COLUMN sessions.opponent_name IS
  'Nome do adversário para jogos e amigáveis (ex: "Sporting CP"). '
  'Definido pelo treinador na página de convocatória. NULL para treinos.';
