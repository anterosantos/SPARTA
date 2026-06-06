# Admin Schema Validation Guide (Story 8.1)

This guide documents how to manually validate the admin schema migrations (000381-000385) in the Supabase PostgreSQL environment.

## Migrations

The following migrations create the admin schema:

1. `000381_admin_rosters.sql` — Rosters table with RLS and unique constraint
2. `000382_admin_teams.sql` — Teams table with flexible escalao/level
3. `000383_admin_team_players.sql` — Team-players junction with status lifecycle
4. `000384_admin_team_coaches.sql` — Team-coaches junction with role assignment
5. `000385_admin_player_loans.sql` — Player loans with approval workflow

## Manual Validation (SQL)

### 1. Verify Tables Exist

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  AND table_name IN ('rosters', 'teams', 'team_players', 'team_coaches', 'player_loans')
ORDER BY table_name;
```

Expected result: 5 rows (all admin tables present).

### 2. Verify Rosters Constraints

```sql
-- Check unique constraint on (club_id, season_id) WHERE status='active'
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'rosters' AND constraint_type = 'UNIQUE';
```

Expected: `rosters_unique_active_per_season` constraint exists.

```sql
-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'rosters' AND indexname LIKE 'idx_rosters%';
```

Expected: At least 2 indexes (`idx_rosters_club_season`, `idx_rosters_club_active`).

### 3. Verify Rosters RLS Policies

```sql
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'rosters'
ORDER BY policyname;
```

Expected policies:
- `rosters_staff_read` (SELECT)
- `rosters_staff_insert` (INSERT)
- `rosters_staff_update` (UPDATE)
- `rosters_service_all` (ALL)

### 4. Verify Teams Table

```sql
-- Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'teams'
ORDER BY ordinal_position;
```

Expected columns:
- id (uuid, NOT NULL)
- roster_id (uuid, NOT NULL, FK rosters)
- name (text, NOT NULL)
- escalao (text, NULL) — no constraint
- level (text, NULL) — no constraint
- is_b_team (boolean, NOT NULL)
- color_hex (text, NULL)
- description (text, NULL)
- is_archived (boolean, NOT NULL)
- created_at, updated_at (timestamptz)

### 5. Verify Team-Players Unique Constraint

```sql
-- Check unique constraint on (team_id, player_id, status) WHERE status='active'
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'team_players' AND constraint_type = 'UNIQUE';
```

Expected: `team_players_unique_active_per_roster` constraint exists.

### 6. Verify Team-Coaches (No Unique Constraint)

```sql
-- Confirm NO unique constraint on (team_id, profile_id)
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'team_coaches' AND constraint_type = 'UNIQUE';
```

Expected: 0 rows (no unique constraint allowing multiple roles per coach).

### 7. Verify Player-Loans Foreign Keys

```sql
-- Check FK relationships
SELECT constraint_name, column_name, referenced_table_name, referenced_column_name
FROM information_schema.referential_constraints
JOIN information_schema.key_column_usage USING (constraint_name)
WHERE table_name = 'player_loans';
```

Expected FK relationships:
- player_loans.player_id → players.id (CASCADE)
- player_loans.from_team_id → teams.id (CASCADE)
- player_loans.to_team_id → teams.id (CASCADE)
- player_loans.requested_by → profiles.id (SET NULL)
- player_loans.approved_by → profiles.id (SET NULL)

### 8. Verify RLS is Enabled on All Tables

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('rosters', 'teams', 'team_players', 'team_coaches', 'player_loans')
ORDER BY tablename;
```

Expected: All tables have `rowsecurity = true`.

### 9. Verify Triggers for auto-update updated_at

```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('rosters', 'teams', 'team_players', 'team_coaches', 'player_loans')
ORDER BY event_object_table;
```

Expected: One BEFORE UPDATE trigger per table (e.g., `rosters_update_updated_at`).

## Integration Test Validation

Run the Vitest integration tests (requires live Supabase connection):

```bash
cd sparta
npm run test -- admin-schema.integration.test.ts
```

Expected: All 16 tests pass (or skip if no DB connection).

## Acceptance Criteria Checklist

- [ ] AC #1: `rosters` table exists with club isolation, unique constraint, and indexes
- [ ] AC #2: `teams` table exists with flexible escalao/level (no constraints)
- [ ] AC #3: `team_players` table exists with unique constraint on active status
- [ ] AC #4: `team_coaches` table exists with no unique constraint (edge case allowed)
- [ ] AC #5: `player_loans` table exists with approval workflow and FK relationships
- [ ] AC #6: Audit logging triggers auto-insert into `audit_logs` (verify in CI/logs)
- [ ] AC #7: CI validation passes (migrations applied successfully in CI environment)

## Notes

- RLS policies use `public.club_id()` function (defined in migration 000030)
- All tables use `uuidv7()` for IDs (defined in migration 000010)
- Cascade deletes ensure data integrity (e.g., deleting roster cascades to teams, team_players, etc.)
- No audit logging triggers are implemented in this story; AC #6 is a placeholder for Story 8.2+
