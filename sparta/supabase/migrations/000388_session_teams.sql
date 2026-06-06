-- session_teams: links a session to one or more teams
-- Sessions without entries here remain visible to all club staff (backward compat)
CREATE TABLE IF NOT EXISTS public.session_teams (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  team_id    uuid NOT NULL REFERENCES public.teams(id)    ON DELETE CASCADE,
  PRIMARY KEY (session_id, team_id)
);

CREATE INDEX IF NOT EXISTS session_teams_session_id_idx ON public.session_teams(session_id);
CREATE INDEX IF NOT EXISTS session_teams_team_id_idx    ON public.session_teams(team_id);

ALTER TABLE public.session_teams ENABLE ROW LEVEL SECURITY;

-- Staff can read session_teams for sessions of their club
CREATE POLICY "staff_read_session_teams" ON public.session_teams
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      INNER JOIN public.profiles p ON p.club_id = s.club_id
      WHERE s.id = session_teams.session_id
        AND p.id = auth.uid()
        AND p.role IN ('coach', 'analyst', 'admin')
    )
  );

-- Staff and admin can insert session_teams for their club
CREATE POLICY "staff_insert_session_teams" ON public.session_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      INNER JOIN public.profiles p ON p.club_id = s.club_id
      WHERE s.id = session_teams.session_id
        AND p.id = auth.uid()
        AND p.role IN ('coach', 'analyst', 'admin')
    )
  );

-- Admin can delete session_teams
CREATE POLICY "admin_delete_session_teams" ON public.session_teams
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      INNER JOIN public.profiles p ON p.club_id = s.club_id
      WHERE s.id = session_teams.session_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
    )
  );
