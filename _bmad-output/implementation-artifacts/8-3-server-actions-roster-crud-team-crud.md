---
story_id: "8.3"
story_key: "8-3-server-actions-roster-crud-team-crud"
epic: "Epic 8"
status: "ready-for-dev"
created: 2026-06-05
depends_on:
  - "8-1-database-schema-rosters-teams-team-players-team-coaches-player-loans"
---

# Story 8.3: Server Actions — Roster CRUD & Team CRUD

Create, edit, and archive rosters and teams via Server Actions.

## Acceptance Criteria

- createRoster(clubId, seasonId, name?) → creates active roster
- updateRoster(rosterId, updates) → updates roster, logs
- archiveRoster(rosterId) → sets is_archived=true, cascades to child teams
- createTeam(rosterId, name, ...) → validates roster not archived
- updateTeam(teamId, updates) → updates fields, logs
- archiveTeam(teamId) → soft-delete, logs
- All actions validate permissions and audit log changes

## Technical

File: src/lib/actions/admin.ts (NEW)

All CRUD operations with Result<T> pattern, RLS enforcement, audit logging.

**Completed:** Ultimate context engine analysis ✅

---

## Implementation Summary

### Server Actions Created ✅

**File:** `sparta/src/lib/actions/admin.ts` (expanded)

**Story 8.3 — Roster CRUD:**
1. **createRoster(seasonId, name)** — Creates active roster, validates season, checks no existing
2. **updateRoster(rosterId, updates)** — Updates name/status, validates inputs, logs
3. **archiveRoster(rosterId)** — Soft-delete, cascades to child teams

**Story 8.3 — Team CRUD:**
1. **createTeam(rosterId, name, ...)** — Creates team, validates roster not archived
2. **updateTeam(teamId, updates)** — Updates fields (escalao, level, color, etc.), logs
3. **archiveTeam(teamId)** — Soft-delete, logs

### Key Features

- ✅ Input validation (name length, status enum, etc.)
- ✅ Ownership verification (club_id isolation)
- ✅ Audit logging on all operations
- ✅ RLS enforcement via service-role + club_id checks
- ✅ Clear error responses (code + message)
- ✅ Cascading prevents orphaned records

### Acceptance Criteria

- ✅ createRoster → creates active roster
- ✅ updateRoster → updates, logs
- ✅ archiveRoster → cascades
- ✅ createTeam → validates roster not archived
- ✅ updateTeam → updates, logs
- ✅ archiveTeam → soft-delete, logs
- ✅ All validate permissions + audit log

### Ready for Code Review

Story 8.3 is complete and integrated with 8.2 in admin.ts.
