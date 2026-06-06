-- Migration: 000386_admin_role
-- Purpose: Add 'admin' role to profiles table for club admin access
-- Story: Epic 8 — Admin Module Access Control

-- Drop existing role constraint and add 'admin' to allowed values
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('coach', 'analyst', 'player', 'admin'));

COMMENT ON COLUMN profiles.role IS
  'Role-based access control: admin (club admin), coach (staff), analyst (staff), player (athlete).';
