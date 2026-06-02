-- Migration: 000315_fatigue_wellness_fields
-- Purpose: Sprint 1.5 — Adicionar campos de bem-estar ao questionário de fadiga
--   muscle_pain_zones: zonas de dor muscular selecionadas no pós-sessão (FR21b)
--   has_exams_this_week: flag booleano de contexto de carga (FR21c)
-- Stories: T1.5.1

ALTER TABLE fatigue_responses
  ADD COLUMN IF NOT EXISTS muscle_pain_zones text[] NULL,
  ADD COLUMN IF NOT EXISTS has_exams_this_week boolean NULL;

COMMENT ON COLUMN fatigue_responses.muscle_pain_zones IS
  'Zonas de dor/desconforto seleccionadas pelo jogador no questionário pós-sessão (FR21b). '
  'Valores válidos: head, neck, shoulder_l, shoulder_r, elbow_l, elbow_r, wrist_l, wrist_r, '
  'hand_l, hand_r, chest, abdomen, back_upper_l, back_upper_r, back_lower_l, back_lower_r, '
  'hip_l, hip_r, thigh_l, thigh_r, knee_l, knee_r, calf_l, calf_r, ankle_l, ankle_r, '
  'achilles_l, achilles_r, foot_l, foot_r. '
  'NULL em fase pre. Array vazio = sem dores seleccionadas.';

COMMENT ON COLUMN fatigue_responses.has_exams_this_week IS
  'Flag booleano de contexto de carga académica — "tens testes/exames esta semana?" (FR21c). '
  'NULL em fase post. true/false apenas em fase pre.';
