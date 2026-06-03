-- Migration: 000330_match_events_zones
-- Purpose: Sprint 1.5 — Expandir zonas do campo de 9 para 12 sectores
--   Meio campo dividido em duas bandas: defensiva e ofensiva (3 cols × 4 linhas)
--   mid_left/mid_center/mid_right → mid_def_* + mid_att_*

ALTER TABLE match_events
  DROP CONSTRAINT IF EXISTS match_events_zone_check;

ALTER TABLE match_events
  ADD CONSTRAINT match_events_zone_check CHECK (zone IN (
    'def_left',     'def_center',     'def_right',
    'mid_def_left', 'mid_def_center', 'mid_def_right',
    'mid_att_left', 'mid_att_center', 'mid_att_right',
    'att_left',     'att_center',     'att_right',
    -- valores legados (dados históricos)
    'mid_left', 'mid_center', 'mid_right'
  ));

COMMENT ON COLUMN match_events.zone IS
  'Sector do campo onde ocorreu o evento. 12 sectores activos: '
  'def_left, def_center, def_right, '
  'mid_def_left, mid_def_center, mid_def_right, '
  'mid_att_left, mid_att_center, mid_att_right, '
  'att_left, att_center, att_right. '
  'Valores mid_left/mid_center/mid_right mantidos para compatibilidade com dados históricos.';
