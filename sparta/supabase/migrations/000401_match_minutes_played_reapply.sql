-- Migration: 000401_match_minutes_played_reapply
-- Purpose: Reaplicar a correcção de 000400, que era inválida (CREATE OR REPLACE VIEW
-- não pode remover colunas — "cannot drop columns from view") e por isso falhou no
-- CI (jobs test/migration-validate) e muito provavelmente também no deploy de
-- produção. O script de deploy (scripts/push-migrations.sh) marca uma migration
-- como aplicada em _schema_migrations mesmo quando falha, por isso corrigir só o
-- ficheiro 000400 não é suficiente para ambientes onde já foi "marcada" como feita
-- sem ter realmente corrido com sucesso — esta migration repete exactamente a mesma
-- definição (CREATE OR REPLACE VIEW é idempotente, seguro correr outra vez).

CREATE OR REPLACE VIEW match_minutes_played AS
SELECT
  mls.session_id,
  mls.player_id,
  s.duration_min,
  MIN(mls.started_minute) AS started_minute,
  MAX(mls.ended_minute) AS ended_minute,
  SUM(
    COALESCE(mls.ended_minute, s.duration_min) - mls.started_minute
  )::int AS minutes_played
FROM match_lineup_stints mls
JOIN sessions s ON s.id = mls.session_id
GROUP BY mls.session_id, mls.player_id, s.duration_min;

GRANT SELECT ON match_minutes_played TO authenticated;
GRANT SELECT ON match_minutes_played TO service_role;
