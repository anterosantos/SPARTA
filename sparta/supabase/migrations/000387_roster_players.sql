-- roster_players: players registered to a roster for a season
-- A player can be in a roster without being assigned to a specific team
CREATE TABLE IF NOT EXISTS public.roster_players (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  roster_id uuid NOT NULL REFERENCES public.rosters(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(roster_id, player_id)
);

CREATE INDEX IF NOT EXISTS roster_players_roster_id_idx ON public.roster_players(roster_id);
CREATE INDEX IF NOT EXISTS roster_players_player_id_idx ON public.roster_players(player_id);

ALTER TABLE public.roster_players ENABLE ROW LEVEL SECURITY;

-- Staff and admin can read roster_players for their club
CREATE POLICY "staff_read_roster_players" ON public.roster_players
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rosters r
      INNER JOIN public.profiles p ON p.club_id = r.club_id
      WHERE r.id = roster_players.roster_id
        AND p.id = auth.uid()
        AND p.role IN ('coach', 'analyst', 'admin')
    )
  );

-- Staff and admin can insert/update roster_players for their club
CREATE POLICY "staff_write_roster_players" ON public.roster_players
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rosters r
      INNER JOIN public.profiles p ON p.club_id = r.club_id
      WHERE r.id = roster_players.roster_id
        AND p.id = auth.uid()
        AND p.role IN ('coach', 'analyst', 'admin')
    )
  );

CREATE POLICY "staff_update_roster_players" ON public.roster_players
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rosters r
      INNER JOIN public.profiles p ON p.club_id = r.club_id
      WHERE r.id = roster_players.roster_id
        AND p.id = auth.uid()
        AND p.role IN ('coach', 'analyst', 'admin')
    )
  );

-- Backfill: register existing team_players into roster_players
INSERT INTO public.roster_players (roster_id, player_id, joined_at)
SELECT DISTINCT
  t.roster_id,
  tp.player_id,
  tp.joined_at
FROM public.team_players tp
JOIN public.teams t ON t.id = tp.team_id
WHERE tp.is_archived = false
ON CONFLICT (roster_id, player_id) DO NOTHING;
