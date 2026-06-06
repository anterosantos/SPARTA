-- Migration: 000381_admin_rosters
-- Purpose: Create rosters table for club/season-based player roster management
-- Story: Epic 8.1 AC #1
-- Depends: 000020_clubs_profiles.sql (clubs table) + 000050_seasons.sql (seasons table)

-- =============================================================================
-- 1. rosters table — multi-tenant with soft-delete
-- =============================================================================

CREATE TABLE rosters (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: max 1 active roster per (club, season)
-- Note: WHERE clause requires CREATE UNIQUE INDEX, not ALTER TABLE ADD CONSTRAINT
CREATE UNIQUE INDEX rosters_unique_active_per_season
  ON rosters(club_id, season_id)
  WHERE status = 'active';

-- Indexes
CREATE INDEX idx_rosters_club_season ON rosters(club_id, season_id, status);
CREATE INDEX idx_rosters_club_active ON rosters(club_id) WHERE status = 'active';

-- Documentation
COMMENT ON TABLE rosters IS 'Container for seasonal player rosters. Each club has one active roster per season.';
COMMENT ON COLUMN rosters.id IS 'UUIDv7 primary key.';
COMMENT ON COLUMN rosters.club_id IS 'Foreign key to clubs(id). Cascades on delete.';
COMMENT ON COLUMN rosters.season_id IS 'Foreign key to seasons(id). Cascades on delete.';
COMMENT ON COLUMN rosters.name IS 'Roster name (e.g., "Plantel 2026").';
COMMENT ON COLUMN rosters.status IS 'Status: active or archived.';
COMMENT ON COLUMN rosters.is_archived IS 'Soft-delete flag for logical archiving.';

-- =============================================================================
-- 2. RLS POLICIES — rosters
-- =============================================================================

ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;

-- Policy 1: Staff (coach, analyst) read own club rosters
CREATE POLICY "rosters_staff_read" ON rosters
  FOR SELECT
  TO authenticated
  USING (
    club_id = public.club_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 2: Staff insert into own club
CREATE POLICY "rosters_staff_insert" ON rosters
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = public.club_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 3: Staff update own club rosters
CREATE POLICY "rosters_staff_update" ON rosters
  FOR UPDATE
  TO authenticated
  USING (
    club_id = public.club_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  )
  WITH CHECK (
    club_id = public.club_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 4: Service-role full access
CREATE POLICY "rosters_service_all" ON rosters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 3. TRIGGERS — auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_rosters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rosters_update_updated_at BEFORE UPDATE ON rosters
  FOR EACH ROW
  EXECUTE FUNCTION update_rosters_updated_at();

-- =============================================================================
-- 4. GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON rosters TO authenticated;
GRANT ALL ON rosters TO service_role;
