-- Migration: 000384_admin_team_coaches
-- Purpose: Create team_coaches junction table for coach assignment with roles
-- Story: Epic 8.1 AC #4
-- Depends: 000382_admin_teams.sql + 000020_clubs_profiles.sql (profiles table)

-- =============================================================================
-- 1. team_coaches table — coach assignment with role and lifecycle
-- =============================================================================

CREATE TABLE team_coaches (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'assistant' CHECK (role IN ('principal', 'assistant', 'analyst')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness constraint: One coach assignment per team (prevents duplicates)
ALTER TABLE team_coaches ADD UNIQUE (team_id, profile_id);

-- Indexes
CREATE INDEX idx_team_coaches_team_role ON team_coaches(team_id, role);
CREATE INDEX idx_team_coaches_profile_archived ON team_coaches(profile_id, is_archived);
CREATE INDEX idx_team_coaches_team_active ON team_coaches(team_id) WHERE is_archived = false;

-- Documentation
COMMENT ON TABLE team_coaches IS 'Assignment of coaches to teams with role tracking. Multiple roles per coach allowed (edge case).';
COMMENT ON COLUMN team_coaches.team_id IS 'Foreign key to teams(id). Cascades on delete.';
COMMENT ON COLUMN team_coaches.profile_id IS 'Foreign key to profiles(id). Cascades on delete.';
COMMENT ON COLUMN team_coaches.role IS 'Role: principal (head coach), assistant (assistant coach), or analyst.';
COMMENT ON COLUMN team_coaches.joined_at IS 'When coach joined team (defaults to now()).';
COMMENT ON COLUMN team_coaches.left_at IS 'When coach left team (NULL while active).';
COMMENT ON COLUMN team_coaches.is_archived IS 'Soft-delete flag.';

-- =============================================================================
-- 2. RLS POLICIES — team_coaches
-- =============================================================================

ALTER TABLE team_coaches ENABLE ROW LEVEL SECURITY;

-- Policy 1: Staff (coach, analyst) read team_coaches in own club teams
CREATE POLICY "team_coaches_staff_read" ON team_coaches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = team_coaches.team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 2: Staff insert team_coaches
CREATE POLICY "team_coaches_staff_insert" ON team_coaches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = team_coaches.team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 3: Staff update team_coaches
CREATE POLICY "team_coaches_staff_update" ON team_coaches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = team_coaches.team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = team_coaches.team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 4: Service-role full access
CREATE POLICY "team_coaches_service_all" ON team_coaches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 3. TRIGGERS — auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_team_coaches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_coaches_update_updated_at BEFORE UPDATE ON team_coaches
  FOR EACH ROW
  EXECUTE FUNCTION update_team_coaches_updated_at();

-- =============================================================================
-- 4. GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON team_coaches TO authenticated;
GRANT ALL ON team_coaches TO service_role;
