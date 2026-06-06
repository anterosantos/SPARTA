-- Migration: 000383_admin_team_players
-- Purpose: Create team_players junction table with position tracking
-- Story: Epic 8.1 AC #3
-- Depends: 000382_admin_teams.sql + 000070_players_positions.sql (players table)

-- =============================================================================
-- 1. team_players table — player membership with status lifecycle
-- =============================================================================

CREATE TABLE team_players (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'loaned', 'reserve')),
  position text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one active assignment per (roster, player)
-- Query: (SELECT DISTINCT roster_id FROM teams WHERE id = team_id) — a player can be active in only one team per roster
ALTER TABLE team_players
  ADD CONSTRAINT team_players_unique_active_per_roster
  UNIQUE (team_id, player_id, status) WHERE status = 'active';

-- Indexes
CREATE INDEX idx_team_players_team_status ON team_players(team_id, status);
CREATE INDEX idx_team_players_player_status ON team_players(player_id, status);
CREATE INDEX idx_team_players_player_active ON team_players(player_id) WHERE status = 'active';

-- Documentation
COMMENT ON TABLE team_players IS 'Membership of players in teams. Tracks status lifecycle (active→loaned→reserve→returned).';
COMMENT ON COLUMN team_players.team_id IS 'Foreign key to teams(id). Cascades on delete.';
COMMENT ON COLUMN team_players.player_id IS 'Foreign key to players(id). Cascades on delete.';
COMMENT ON COLUMN team_players.status IS 'Status: active (in team), loaned (to another team), or reserve.';
COMMENT ON COLUMN team_players.position IS 'Primary position (e.g., "GK", "CB", "LB", "CM", "ST"). Optional.';
COMMENT ON COLUMN team_players.joined_at IS 'When player joined team (defaults to now()).';
COMMENT ON COLUMN team_players.left_at IS 'When player left team (NULL while active).';

-- =============================================================================
-- 2. RLS POLICIES — team_players
-- =============================================================================

ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;

-- Policy 1: Staff (coach, analyst) read team_players in own club teams
CREATE POLICY "team_players_staff_read" ON team_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = team_players.team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 2: Staff insert team_players
CREATE POLICY "team_players_staff_insert" ON team_players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = team_players.team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 3: Staff update team_players
CREATE POLICY "team_players_staff_update" ON team_players
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = team_players.team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = team_players.team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 4: Service-role full access
CREATE POLICY "team_players_service_all" ON team_players
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 3. TRIGGERS — auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_team_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_players_update_updated_at BEFORE UPDATE ON team_players
  FOR EACH ROW
  EXECUTE FUNCTION update_team_players_updated_at();

-- =============================================================================
-- 4. GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON team_players TO authenticated;
GRANT ALL ON team_players TO service_role;
