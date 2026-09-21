-- Migration: 000405_match_events_zones_v2
-- Purpose: Expandir zonas do campo de 12 para 24 sectores (6 linhas × 4 colunas
--   — ataque linha de fundo / ataque entrada área / meio campo ofensivo /
--   meio campo defensivo / defesa entrada área / defesa linha de fundo).
--
-- Mesmo padrão da migração 000330: os valores antigos NUNCA são removidos do
-- CHECK — jogos já capturados continuam válidos e continuam a mostrar-se com
-- o layout com que foram jogados (ver LEGACY_MATCH_ZONES/LEGACY_MATCH_ZONE_LABEL
-- em src/lib/schemas/match-events.ts). Só os eventos NOVOS passam a usar as
-- 24 zonas actuais.

ALTER TABLE match_events
  DROP CONSTRAINT IF EXISTS match_events_zone_check;

ALTER TABLE match_events
  ADD CONSTRAINT match_events_zone_check CHECK (zone IN (
    -- 24 zonas activas (esta migração)
    'att_end_left',  'att_end_midleft',  'att_end_midright',  'att_end_right',
    'att_box_left',  'att_box_midleft',  'att_box_midright',  'att_box_right',
    'mid_off_left',  'mid_off_midleft',  'mid_off_midright',  'mid_off_right',
    'mid_back_left', 'mid_back_midleft', 'mid_back_midright', 'mid_back_right',
    'def_box_left',  'def_box_midleft',  'def_box_midright',  'def_box_right',
    'def_end_left',  'def_end_midleft',  'def_end_midright',  'def_end_right',
    -- valores legados (000330) — dados históricos, 12 sectores
    'def_left',     'def_center',     'def_right',
    'mid_def_left', 'mid_def_center', 'mid_def_right',
    'mid_att_left', 'mid_att_center', 'mid_att_right',
    'att_left',     'att_center',     'att_right',
    -- valores ainda mais antigos (pré-000330) — dados históricos, 9 sectores
    'mid_left', 'mid_center', 'mid_right'
  ));

COMMENT ON COLUMN match_events.zone IS
  'Sector do campo onde ocorreu o evento. 24 sectores activos (ver '
  'MATCH_ZONES em src/lib/schemas/match-events.ts). Valores de 000330 '
  '(12 sectores) e anteriores (mid_left/center/right, 9 sectores) mantidos '
  'para compatibilidade com dados históricos — nunca reinterpretados como '
  'as novas 24 zonas.';
