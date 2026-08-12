-- Migration: 000396_sessions_medical_other_types
-- Purpose: Add "medical" (Médico/Fisio) and "other" (Outros) as valid sessions.type
-- values — sem questionário de fadiga, tal como "lecture".

ALTER TABLE sessions DROP CONSTRAINT sessions_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_type_check
  CHECK (type IN ('training', 'match', 'friendly', 'lecture', 'medical', 'other'));

COMMENT ON COLUMN sessions.type IS 'training | match | friendly | lecture | medical | other';
