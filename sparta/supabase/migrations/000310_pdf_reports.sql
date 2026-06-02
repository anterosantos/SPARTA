-- Migration: 000310_pdf_reports
-- Purpose: Armazenar metadados de relatórios PDF gerados e partilhados (FR59)
-- Dependencies: uuidv7() (000010), profiles (000020), players (000070), clubs (000020)
--
-- ATENÇÃO: O bucket 'reports' não é criado por migration SQL.
-- Requer criação manual no Supabase Console antes do deploy:
--   Storage > New Bucket > Name: reports > Private: YES
-- Path pattern: {club_id}/{player_id}/{timestamp}-{scope}.pdf

CREATE TABLE public.pdf_reports (
  id                uuid        PRIMARY KEY DEFAULT public.uuidv7(),
  club_id           uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id         uuid        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  generated_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  scope             text        NOT NULL CHECK (scope IN ('match', 'training', 'period')),
  period_start      date        NOT NULL,
  period_end        date        NOT NULL,
  file_path         text        NOT NULL,
  generated_at      timestamptz NOT NULL DEFAULT now(),
  shared_with_email citext,
  shared_at         timestamptz,
  expires_at        timestamptz NOT NULL,
  CONSTRAINT period_start_before_end CHECK (period_start <= period_end)
);

CREATE INDEX idx_pdf_reports_club   ON public.pdf_reports(club_id);
CREATE INDEX idx_pdf_reports_player ON public.pdf_reports(player_id);

ALTER TABLE public.pdf_reports ENABLE ROW LEVEL SECURITY;

-- Staff do mesmo clube pode ler
CREATE POLICY "pdf_reports_staff_read"
  ON public.pdf_reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = pdf_reports.club_id
    )
  );

-- Staff do mesmo clube pode inserir
CREATE POLICY "pdf_reports_staff_insert"
  ON public.pdf_reports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = pdf_reports.club_id
    )
  );

-- Staff do mesmo clube pode actualizar (partilha, revogação via expires_at)
-- WITH CHECK garante que club_id/player_id não podem ser alterados para outro clube
CREATE POLICY "pdf_reports_staff_update"
  ON public.pdf_reports FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = pdf_reports.club_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = pdf_reports.club_id
    )
  );
