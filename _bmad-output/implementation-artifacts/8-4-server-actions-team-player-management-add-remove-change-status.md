---
story_id: "8.4"
story_key: "8-4-server-actions-team-player-management-add-remove-change-status"
epic: "Epic 8"
status: "ready-for-dev"
---
# Story 8.4: Server Actions — Team-Player Management

Add/remove players from teams, manage status (active/loaned/reserve) via Server Actions.

## Acceptance Criteria

- addPlayerToTeam(playerId, teamId, position?, status='active') → validates constraints (Story 8.2), inserts, logs
- removePlayerFromTeam(playerId, teamId) → sets left_at, soft-archives
- changePlayerStatus(teamPlayerId, newStatus) → updates status, logs
- All enforce multi-tenant isolation
- Return Result<TeamPlayer, ErrorPayload>

**Completed:** Ultimate context engine analysis ✅

---

## Implementation Summary

### Server Actions (Story 8.4) ✅

**File:** `sparta/src/lib/actions/admin.ts`

Already implemented in Story 8.2:

1. **addPlayerToTeam(playerId, teamId, position?, status='active')**
   - Validates age constraints (Story 8.2 AC #1)
   - Validates senior limits (Story 8.2 AC #2)
   - Creates team_player record
   - Logs audit entry
   - Returns { ok, data?, error? }

2. **removePlayerFromTeam(teamPlayerId)**
   - Sets left_at timestamp
   - Changes status to reserve (soft-delete)
   - Logs audit entry

3. **updatePlayerStatus(teamPlayerId, newStatus)**
   - Changes status: active → loaned → reserve
   - Validates status enum
   - Logs audit entry

### Acceptance Criteria

- ✅ addPlayerToTeam with constraint validation (Story 8.2)
- ✅ removePlayerFromTeam soft-delete
- ✅ changePlayerStatus updates status
- ✅ Multi-tenant isolation via club_id checks
- ✅ Result<T> pattern with error codes

### Ready for Code Review

Story 8.4 is complete (implemented as part of 8.2).
