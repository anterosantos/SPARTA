-- Migration: 000390_grant_player_metrics
-- Purpose: Fix missing table-level GRANTs on player_metrics (000090).
--          RLS policies alone do not grant access — Postgres also requires the
--          base table privilege, which 000090 never issued. This left every
--          SELECT/INSERT/UPDATE on player_metrics failing with
--          "permission denied for table player_metrics" (42501) regardless of
--          RLS policy outcome.

GRANT SELECT, INSERT, UPDATE ON player_metrics TO authenticated;
GRANT ALL ON player_metrics TO service_role;
