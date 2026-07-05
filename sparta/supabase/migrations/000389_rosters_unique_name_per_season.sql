-- Migration: 000389_rosters_unique_name_per_season
-- Purpose: Allow multiple active rosters per (club, season); enforce unique
--          name (case-insensitive) among active rosters within a season instead.
-- Story: Epic 8 business rule change (post-8.1 correction)

DROP INDEX IF EXISTS rosters_unique_active_per_season;

-- Partial unique index: no two active rosters share a name (case-insensitive) within the same season
CREATE UNIQUE INDEX rosters_unique_active_name_per_season
  ON rosters (club_id, season_id, lower(name))
  WHERE status = 'active';

COMMENT ON TABLE rosters IS 'Container for seasonal player rosters. A club can have multiple active rosters per season, but names must be unique (case-insensitive) among them.';
