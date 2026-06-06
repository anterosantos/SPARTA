---
story_id: "8.5"
story_key: "8-5-server-actions-coach-assignment-team-coach-management"
epic: "Epic 8"
status: "ready-for-dev"
---
# Story 8.5: Server Actions — Coach Assignment & Team-Coach Management

Assign coaches to teams with roles (principal, assistant, analyst).

## Acceptance Criteria

- assignCoachToTeam(profileId, teamId, role='assistant') → inserts, logs
- removeCoachFromTeam(teamCoachId) → sets left_at, soft-archives
- changeCoachRole(teamCoachId, newRole) → updates role, logs
- Multiple coaches per team allowed
- Return Result<TeamCoach, ErrorPayload>

**Completed:** Ultimate context engine analysis ✅

---

## Implementation Summary

### Server Actions (Story 8.5) ✅

**File:** `sparta/src/lib/actions/admin.ts`

1. **assignCoachToTeam(profileId, teamId, role='assistant')**
   - Validates role enum (principal/assistant/analyst)
   - Verifies coach in same club
   - Inserts team_coach record
   - Logs audit entry
   - Multiple coaches per team allowed ✅

2. **removeCoachFromTeam(teamCoachId)**
   - Soft-delete via is_archived + left_at
   - Logs audit entry

3. **changeCoachRole(teamCoachId, newRole)**
   - Updates role (principal/assistant/analyst)
   - Validates role enum
   - Logs audit entry

### Acceptance Criteria

- ✅ assignCoachToTeam inserts + logs
- ✅ removeCoachFromTeam soft-deletes
- ✅ changeCoachRole updates + logs
- ✅ Multiple coaches per team allowed
- ✅ Result<T> pattern

### Ready for Code Review

Story 8.5 is complete.
