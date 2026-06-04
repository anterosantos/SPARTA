-- Migration: 000330_attendance_sem_questionario
-- Purpose: Adicionar estado "sem_questionario" ao registo de presenças
--   sem_questionario: estado inicial de um jogador até preencher o questionário pré-sessão.
--   Quando o jogador submete o questionário pré, o estado transita automaticamente para 'present'.
--   Após essa transição, o staff pode alterar para qualquer estado.

ALTER TABLE attendances
  DROP CONSTRAINT IF EXISTS attendances_status_check;

ALTER TABLE attendances
  ADD CONSTRAINT attendances_status_check
  CHECK (status IN ('sem_questionario', 'present', 'absent', 'late', 'injured', 'excused'));

COMMENT ON COLUMN attendances.status IS
  'Estado de presença do jogador na sessão. '
  'sem_questionario = estado inicial até o jogador submeter o questionário pré-sessão; '
  'present = presente (estado após questionário pré ou definido pelo staff); '
  'absent = ausente; late = atrasado; injured = lesionado; excused = justificado.';
