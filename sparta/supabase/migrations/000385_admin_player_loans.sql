-- Migration: 000385_admin_player_loans
-- Purpose: Create player_loans table for inter-club player loan workflow
-- Story: Epic 8.1 AC #5
-- Depends: 000382_admin_teams.sql + 000070_players_positions.sql (players table) + 000020_clubs_profiles.sql (profiles table)

-- =============================================================================
-- 1. player_loans table — loan request/approval lifecycle
-- =============================================================================

CREATE TABLE player_loans (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  from_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  to_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  returned_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_player_loans_player_status ON player_loans(player_id, status);
CREATE INDEX idx_player_loans_from_team_status ON player_loans(from_team_id, status);
CREATE INDEX idx_player_loans_to_team_status ON player_loans(to_team_id, status);
CREATE INDEX idx_player_loans_status_approved ON player_loans(status, approved_at);

-- Documentation
COMMENT ON TABLE player_loans IS 'Inter-club player loan requests and approvals. Tracks request → approval → return lifecycle.';
COMMENT ON COLUMN player_loans.player_id IS 'Foreign key to players(id). Cascades on delete.';
COMMENT ON COLUMN player_loans.from_team_id IS 'Source team (foreign key to teams(id)). Cascades on delete.';
COMMENT ON COLUMN player_loans.to_team_id IS 'Destination team (foreign key to teams(id)). Cascades on delete.';
COMMENT ON COLUMN player_loans.requested_by IS 'Profile who requested the loan (foreign key to profiles(id)). SET NULL on delete.';
COMMENT ON COLUMN player_loans.approved_by IS 'Profile who approved the loan (foreign key to profiles(id)). SET NULL on delete. NULL until approved/rejected.';
COMMENT ON COLUMN player_loans.status IS 'Status: pending → approved/rejected → returned (for approved loans).';
COMMENT ON COLUMN player_loans.requested_at IS 'When loan was requested (defaults to now()).';
COMMENT ON COLUMN player_loans.approved_at IS 'When loan was approved/rejected (NULL until decision).';
COMMENT ON COLUMN player_loans.returned_at IS 'When loaned player was returned (NULL until returned).';
COMMENT ON COLUMN player_loans.note IS 'Reason for loan or rejection reason.';

-- =============================================================================
-- 2. RLS POLICIES — player_loans
-- =============================================================================

ALTER TABLE player_loans ENABLE ROW LEVEL SECURITY;

-- Policy 1: Staff read loans where both teams are in their club
CREATE POLICY "player_loans_staff_read" ON player_loans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = player_loans.from_team_id
        AND rosters.club_id = public.club_id()
    )
    AND EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = player_loans.to_team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 2: Staff insert loans from their club teams
CREATE POLICY "player_loans_staff_insert" ON player_loans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = player_loans.from_team_id
        AND rosters.club_id = public.club_id()
    )
    AND EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = player_loans.to_team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 3: Staff update (most fields) for loans in their club
CREATE POLICY "player_loans_staff_update" ON player_loans
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = player_loans.from_team_id
        AND rosters.club_id = public.club_id()
    )
    AND EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = player_loans.to_team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = player_loans.from_team_id
        AND rosters.club_id = public.club_id()
    )
    AND EXISTS (
      SELECT 1 FROM teams
      JOIN rosters ON rosters.id = teams.roster_id
      WHERE teams.id = player_loans.to_team_id
        AND rosters.club_id = public.club_id()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 4: Service-role full access
CREATE POLICY "player_loans_service_all" ON player_loans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 3. TRIGGERS — auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_player_loans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_loans_update_updated_at BEFORE UPDATE ON player_loans
  FOR EACH ROW
  EXECUTE FUNCTION update_player_loans_updated_at();

-- =============================================================================
-- 4. GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON player_loans TO authenticated;
GRANT ALL ON player_loans TO service_role;
