-- =============================================================================
-- Admin User Seed Script
-- Creates admin@test.test with role 'admin' for a given club
--
-- Usage:
--   1. Run this script in Supabase SQL Editor (with service-role access)
--   2. Replace the CLUB_ID placeholder with your actual club UUID
--   3. The admin user can log in at /login with:
--      Email:    admin@test.test
--      Password: Admin1234!
--
-- IMPORTANT: Change the password after first login.
-- =============================================================================

DO $$
DECLARE
  v_club_id   uuid;
  v_user_id   uuid := '00000000-0000-7000-b000-000000000099'; -- deterministic UUID for admin
  v_email     text := 'admin@test.test';
  v_password  text := 'Admin1234!';
BEGIN

  -- Step 1: Get the first club in the database (or replace with specific club UUID)
  SELECT id INTO v_club_id FROM public.clubs ORDER BY created_at LIMIT 1;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'No club found. Create a club first.';
  END IF;

  RAISE NOTICE 'Creating admin user for club: %', v_club_id;

  -- Step 2: Create auth user (if not exists)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      role,
      aud
    ) VALUES (
      v_user_id,
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{}',
      '{}',
      'authenticated',
      'authenticated'
    );
    RAISE NOTICE 'Auth user created: %', v_email;
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    RAISE NOTICE 'Auth user already exists: %', v_email;
  END IF;

  -- Step 3: Create profile with role 'admin' (upsert)
  INSERT INTO public.profiles (
    id,
    club_id,
    role,
    full_name,
    consent_status,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_club_id,
    'admin',
    'Administrador',
    'granted', -- admin doesn't need player consent
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    club_id = v_club_id,
    full_name = 'Administrador',
    updated_at = now();

  RAISE NOTICE 'Profile created/updated with role=admin for user: %', v_email;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admin user ready!';
  RAISE NOTICE '  Email:    %', v_email;
  RAISE NOTICE '  Password: %', v_password;
  RAISE NOTICE '  Club:     %', v_club_id;
  RAISE NOTICE '  Role:     admin';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'IMPORTANT: Change the password after first login!';

END $$;
