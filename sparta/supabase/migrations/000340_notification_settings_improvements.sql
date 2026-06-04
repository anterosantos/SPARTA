-- Migration: 000340_notification_settings_improvements
-- Purpose: Duas melhorias à tabela notification_settings:
--
--   1. Adicionar event_edit_window_hours — janela de edição de eventos por clube
--      (estava no código/UI mas não na tabela, causando perda silenciosa de dados)
--
--   2. Activar auto-init trigger — quando um clube é criado, automaticamente
--      cria a linha de notification_settings com os defaults.
--      Também faz backfill para clubes existentes que não têm linha.

-- =============================================================================
-- 1. ADD event_edit_window_hours COLUMN
-- =============================================================================

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS event_edit_window_hours int
    NOT NULL DEFAULT 24
    CHECK (event_edit_window_hours BETWEEN 1 AND 168);

COMMENT ON COLUMN notification_settings.event_edit_window_hours IS
  'Horas após a sessão durante as quais o staff pode editar eventos registados (1–168, default 24). '
  'Configurable por clube — após esta janela os botões de edição ficam bloqueados no UI.';

-- =============================================================================
-- 2. AUTO-INIT TRIGGER para novos clubes
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_auto_notification_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_settings (club_id)
  VALUES (NEW.id)
  ON CONFLICT (club_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_auto_notification_settings ON public.clubs;

CREATE TRIGGER tg_auto_notification_settings
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_notification_settings();

-- =============================================================================
-- 3. BACKFILL — criar linha de defaults para clubes que ainda não têm
-- =============================================================================

INSERT INTO public.notification_settings (club_id)
SELECT id FROM public.clubs
WHERE id NOT IN (SELECT club_id FROM public.notification_settings)
ON CONFLICT (club_id) DO NOTHING;
