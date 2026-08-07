-- Migration: 000395_parental_consent_link_only
-- Purpose: Support staff-initiated parental consent via a copyable link
-- (no email required) — encarregado's name is recorded instead. parent_email
-- was NOT NULL; some consent requests now have no email at all, only a name.

ALTER TABLE public.parental_consents
  ALTER COLUMN parent_email DROP NOT NULL;

ALTER TABLE public.parental_consents
  ADD COLUMN parent_name text;

ALTER TABLE public.parental_consents
  ADD CONSTRAINT parental_consents_contact_check
  CHECK (parent_email IS NOT NULL OR parent_name IS NOT NULL);

COMMENT ON COLUMN public.parental_consents.parent_name IS
  'Nome do encarregado de educação, recolhido quando o consentimento é iniciado via link copiado (sem email). Nulo para pedidos iniciados por email.';

-- Os lembretes automáticos (dia 7 / dia 14) só fazem sentido para pedidos com
-- email — pedidos iniciados por link (sem email) são geridos manualmente pelo
-- staff, que já tem o link para partilhar de novo se necessário.
CREATE OR REPLACE FUNCTION public.parental_consent_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url  text;
  v_service_key   text;
  v_functions_url text;
  r               RECORD;
BEGIN
  BEGIN
    v_supabase_url := current_setting('app.supabase_url');
    v_service_key  := current_setting('app.service_role_key');
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := '';
    v_service_key  := '';
    RAISE WARNING '[parental_consent_reminders] app.supabase_url / app.service_role_key não configurados — HTTP calls ignorados';
  END;

  v_functions_url := v_supabase_url || '/functions/v1';

  -- -----------------------------------------------------------------------
  -- DIA 7: consentimentos pendentes criados exactamente há 7 dias, com email
  -- -----------------------------------------------------------------------
  FOR r IN
    SELECT pc.id AS consent_id
    FROM public.parental_consents pc
    WHERE pc.status = 'pending'
      AND pc.parent_email IS NOT NULL
      AND (pc.created_at AT TIME ZONE 'UTC')::date = (CURRENT_DATE AT TIME ZONE 'UTC') - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.parental_consent_reminders_log l
        WHERE l.consent_id = pc.id
          AND l.kind = 'day_7'
          AND l.sent_at::date = CURRENT_DATE
      )
  LOOP
    BEGIN
      INSERT INTO public.parental_consent_reminders_log(consent_id, kind, status)
      VALUES (r.consent_id, 'day_7', 'pending');
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      BEGIN
        PERFORM net.http_post(
          url     := v_functions_url || '/send-parental-consent',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key,
            'X-Idempotency-Key', 'day_7_' || r.consent_id::text || '_' || CURRENT_DATE::text
          ),
          body    := jsonb_build_object(
            'consentId',    r.consent_id,
            'includePrefix', true,
            'prefixText',   '[Lembrete]'
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[parental_consent_reminders] pg_net day_7 falhou para consent %: %', r.consent_id, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- -----------------------------------------------------------------------
  -- DIA 14: consentimentos pendentes criados exactamente há 14 dias, com email
  -- -----------------------------------------------------------------------
  FOR r IN
    SELECT pc.id AS consent_id
    FROM public.parental_consents pc
    WHERE pc.status = 'pending'
      AND pc.parent_email IS NOT NULL
      AND (pc.created_at AT TIME ZONE 'UTC')::date = (CURRENT_DATE AT TIME ZONE 'UTC') - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.parental_consent_reminders_log l
        WHERE l.consent_id = pc.id
          AND l.kind = 'day_14'
          AND l.sent_at::date = CURRENT_DATE
      )
  LOOP
    BEGIN
      INSERT INTO public.parental_consent_reminders_log(consent_id, kind, status)
      VALUES (r.consent_id, 'day_14', 'pending');
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      BEGIN
        PERFORM net.http_post(
          url     := v_functions_url || '/send-parental-consent',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key,
            'X-Idempotency-Key', 'day_14_' || r.consent_id::text || '_' || CURRENT_DATE::text
          ),
          body    := jsonb_build_object(
            'consentId',    r.consent_id,
            'includePrefix', true,
            'prefixText',   '[2º Lembrete]'
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[parental_consent_reminders] pg_net day_14 falhou para consent %: %', r.consent_id, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- -----------------------------------------------------------------------
  -- ALERTA STAFF: consentimentos pendentes com mais de 14 dias (qualquer origem)
  -- Agrupa por clube e envia um único alerta por clube por dia.
  -- -----------------------------------------------------------------------
  FOR r IN
    SELECT DISTINCT pc.club_id
    FROM public.parental_consents pc
    WHERE pc.status = 'pending'
      AND (pc.created_at AT TIME ZONE 'UTC') < (CURRENT_DATE AT TIME ZONE 'UTC') - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.parental_consent_reminders_log l
        JOIN public.parental_consents pc2 ON pc2.id = l.consent_id
        WHERE pc2.club_id = pc.club_id
          AND l.kind = 'staff_alert'
          AND l.sent_at::date = CURRENT_DATE
      )
  LOOP
    DECLARE v_first_consent uuid;
    BEGIN
      SELECT id INTO v_first_consent
      FROM public.parental_consents
      WHERE club_id = r.club_id
        AND status = 'pending'
        AND created_at < CURRENT_DATE - INTERVAL '14 days'
      LIMIT 1;

      INSERT INTO public.parental_consent_reminders_log(consent_id, kind, status)
      VALUES (v_first_consent, 'staff_alert', 'pending');
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      BEGIN
        PERFORM net.http_post(
          url     := v_functions_url || '/staff-alert-consent',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key,
            'X-Idempotency-Key', 'staff_alert_' || r.club_id::text || '_' || CURRENT_DATE::text
          ),
          body    := jsonb_build_object('clubId', r.club_id)
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[parental_consent_reminders] pg_net staff_alert falhou para clube %: %', r.club_id, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;
