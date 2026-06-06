-- Migration: 000382_admin_teams
-- Purpose: Create teams table for roster sub-groupings (age groups, competition levels)
-- Story: Epic 8.1 AC #2
-- Depends: 000381_admin_rosters.sql

-- =============================================================================
-- 1. teams table — flexible escalao/level with optional visual properties
-- =============================================================================

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  roster_id uuid NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
  name text NOT NULL,
  escalao text,
  level text,
  is_b_team boolean NOT NULL DEFAULT false,
  color_hex text,
  description text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_teams_roster_archived ON teams(roster_id, is_archived);
CREATE INDEX idx_teams_roster_name ON teams(roster_id, name);

-- Documentation
COMMENT ON TABLE teams IS 'Sub-groupings within a roster (e.g., Seniores A, U19, U14). Flexible escalao/level for organizational flexibility.';
COMMENT ON COLUMN teams.roster_id IS 'Foreign key to rosters(id). Cascades on delete.';
COMMENT ON COLUMN teams.escalao IS 'Age group or category (e.g., "u14", "u19", "senior"). Not constrained — flexible for organizational naming.';
COMMENT ON COLUMN teams.level IS 'Competition level or tier (e.g., "1", "2", "A", "B"). Not constrained — flexible.';
COMMENT ON COLUMN teams.is_b_team IS 'Flag for B-team constraints (used in Story 8.2 business rules).';
COMMENT ON COLUMN teams.color_hex IS 'Hex color for visual differentiation in UI (e.g., "#2563EB").';
COMMENT ON COLUMN teams.is_archived IS 'Soft-delete flag.';

-- =============================================================================
-- 2. RLS POLICIES — teams
-- =============================================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Policy 1: Staff (coach, analyst) read teams in own club rosters
CREATE POLICY "teams_staff_read" ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rosters
      WHERE rosters.id = teams.roster_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 2: Staff insert teams into own club rosters
CREATE POLICY "teams_staff_insert" ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rosters
      WHERE rosters.id = teams.roster_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 3: Staff update teams in own club rosters
CREATE POLICY "teams_staff_update" ON teams
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rosters
      WHERE rosters.id = teams.roster_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rosters
      WHERE rosters.id = teams.roster_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 4: Service-role full access
CREATE POLICY "teams_service_all" ON teams
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 3. TRIGGERS — auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_update_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();

-- =============================================================================
-- 4. GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON teams TO authenticated;
GRANT ALL ON teams TO service_role;
