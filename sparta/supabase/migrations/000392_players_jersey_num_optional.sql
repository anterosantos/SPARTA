-- Migration: 000392_players_jersey_num_optional
-- Purpose: Jersey number is no longer mandatory when creating a player from
--          the admin module (/admin/jogadores). The CHECK (1-99) still
--          applies whenever a value IS provided; NULL is now also allowed
--          and doesn't conflict with the existing unique-per-active-club index
--          (Postgres never treats NULL as equal to another NULL).

ALTER TABLE players ALTER COLUMN jersey_num DROP NOT NULL;
