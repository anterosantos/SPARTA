-- Migration: 000393_sessions_lecture_type
-- Purpose: Add "lecture" as a valid sessions.type value (Palestra) — sessão sem componente físico

ALTER TABLE sessions DROP CONSTRAINT sessions_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_type_check
  CHECK (type IN ('training', 'match', 'friendly', 'lecture'));

COMMENT ON COLUMN sessions.type IS 'training | match | friendly | lecture';
