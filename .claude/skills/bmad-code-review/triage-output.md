# Code Review Triage — Epic 8 Admin Module

**Review Date:** 2026-06-06  
**Stories:** 8-1 to 8-8 (all in status: review)  
**Total Findings:** 41 (normalized to 33 after deduplication)  
**All Layers Passed:** ✅ Yes

---

## FINDINGS BY CATEGORY

### 🔴 CRITICAL — Patch Required (4 findings)

| ID | Source | Title | Location | Action |
|----|--------|-------|----------|--------|
| C-1 | blind+edge | SQL injection in `addPlayerToTeam` — subquery string interpolation | sparta/src/lib/actions/admin.ts:1290-1293, 1312-1314 | **PATCH** |
| C-2 | edge | Duplicate coach assignment race condition — no UNIQUE constraint + no app-level check | sparta/src/lib/actions/admin.ts:2210-2229 + 000384_admin_team_coaches.sql | **PATCH** |
| C-3 | edge | Simultaneous roster activation race condition — no SELECT FOR UPDATE | sparta/src/lib/actions/admin.ts:1651-1668 | **PATCH** |
| C-4 | auditor+blind | `approvePlayerLoan` missing team_players status update — player never appears loaned in destination team | sparta/src/lib/actions/admin.ts:2510-2603 | **PATCH** |

**Details:**

**C-1: SQL Injection**
- **Evidence:** Lines 1290-1293 use backtick template strings in Supabase query: `` ` SELECT ... WHERE team_id = '${team.roster_id}' ` ``
- **Risk:** User-controlled values interpolated into SQL without parameterization
- **Fix:** Use Supabase query builder parameter placeholders instead of string interpolation

**C-2: Duplicate Coach Assignment**
- **Evidence:** `assignCoachToTeam` (lines 2210-2229) directly inserts without checking existing assignment
- **DB Schema (000384:3475):** Explicitly states "NO uniqueness constraint on (team_id, profile_id) — multiple roles per coach allowed" but also notes this is an edge case
- **Conflict:** Code allows same coach assigned twice, violating intended semantics
- **Fix:** Add UNIQUE constraint to 000384_admin_team_coaches.sql OR add application-level duplicate check in assignCoachToTeam before insert

**C-3: Roster Activation Race Condition**
- **Evidence:** `createRoster` (lines 1651-1668) checks `WHERE status='active'` but doesn't lock, allowing concurrent inserts to violate UNIQUE constraint
- **Scenario:** Two requests both check "no active roster exists" → both insert → one gets DB error
- **Fix:** Use SELECT ... FOR UPDATE (Supabase: `.select().eq(...).then(..., () => ...)` with retry, or use RLS with application-level deduplication)

**C-4: Missing Loan State Transition**
- **Evidence:** `approvePlayerLoan` sets `player_loans.status='approved'` but spec requires: "updates the `team_players` row for that player on the `to_team` to `status='loaned'`"
- **Impact:** Player is approved for loan but never appears in destination team roster; system is inconsistent
- **Fix:** After approving loan, create/update `team_players` row: `INSERT INTO team_players (team_id, player_id, status='loaned', ...) OR UPDATE status='loaned'`

---

### 🟠 HIGH — Patch Required (15 findings)

| ID | Source | Title | Location | Action |
|----|--------|-------|----------|--------|
| H-1 | edge | Null escalao bypasses age validation | sparta/src/lib/validators/admin.ts:841-868 | **PATCH** |
| H-2 | auditor | `addPlayerToTeam` missing coach assignment verification (FR-ADMIN-4) | sparta/src/lib/actions/admin.ts:1194-1419 | **PATCH** |
| H-3 | auditor | `assignCoachToTeam` missing principal coach authorization (FR-ADMIN-4) | sparta/src/lib/actions/admin.ts:2150-2249 | **PATCH** |
| H-4 | auditor | `removeCoachFromTeam` missing principal coach authorization | sparta/src/lib/actions/admin.ts:2254-2323 | **PATCH** |
| H-5 | auditor | `changeCoachRole` missing principal coach authorization | sparta/src/lib/actions/admin.ts:2328-2403 | **PATCH** |
| H-6 | auditor | `requestPlayerLoan` missing "already loaned" validation (AC #1) | sparta/src/lib/actions/admin.ts:2412-2505 | **PATCH** |
| H-7 | auditor | `requestPlayerLoan` missing "same team" validation (AC #1) | sparta/src/lib/actions/admin.ts:2412-2505 | **PATCH** |
| H-8 | auditor | `returnPlayerLoan` not updating team_players on destination team | sparta/src/lib/actions/admin.ts:2700-2776 | **PATCH** |
| H-9 | auditor | `removePlayerFromTeam` missing `is_archived=true` flag | sparta/src/lib/actions/admin.ts:1424-1504 | **PATCH** |
| H-10 | edge | Missing check for loaned player re-loan | sparta/src/lib/actions/admin.ts:2412-2505 | **PATCH** (merged with H-6) |
| H-11 | edge | Team-to-same-team loans allowed | sparta/src/lib/actions/admin.ts:2412-2505 | **PATCH** (merged with H-7) |
| H-12 | edge | Invalid status transition not prevented in `updatePlayerStatus` | sparta/src/lib/actions/admin.ts:1509-1598 | **PATCH** |
| H-13 | blind | Race condition in `addPlayerToTeam` between count + insert | sparta/src/lib/actions/admin.ts:1318-1334 | **PATCH** |
| H-14 | blind | Type safety issue — unsafe `(loan as any)` casting in `approvePlayerLoan` | sparta/src/lib/actions/admin.ts:544-546 | **PATCH** |
| H-15 | blind | Silent failure in `approvePlayerLoan` — doesn't verify club access | sparta/src/lib/actions/admin.ts:2510-2603 | **PATCH** |

**Details (summary):**

**H-1:** `validateAgeGroupMobility()` returns `{ valid: true }` when team escalao is null, bypassing age constraints for u14 → u13 scenario
- **Fix:** Treat null escalao as "any age allowed" only for flexible teams; add explicit check if spec requires validation

**H-2 to H-5:** Missing authorization checks across coach management operations
- **Fix:** Add queries before insert/update: `EXISTS(SELECT 1 FROM team_coaches WHERE team_id = ? AND profile_id = auth.uid() AND role = 'principal')`

**H-6, H-7:** `requestPlayerLoan` allows nonsensical loan requests (player already loaned, same team)
- **Fix:** Add pre-flight checks: `WHERE team_players.player_id = ? AND status = 'loaned'` and `IF fromTeamId === toTeamId THEN reject`

**H-8:** `returnPlayerLoan` doesn't remove player from destination team roster
- **Fix:** Also update: `team_players.is_archived = true` where `team_id = to_team_id AND player_id = ?`

**H-9:** `removePlayerFromTeam` sets status=reserve but missing is_archived flag per spec
- **Fix:** Also set `is_archived = true` in UPDATE

**H-12:** No state machine validation on `updatePlayerStatus` — allows invalid transitions
- **Fix:** Add validation: loaned can only go to reserve (after loan is returned); active can go to loaned/reserve

**H-13:** Race condition between counting active teams and inserting — another request could violate senior team limit
- **Fix:** Wrap steps 5-11 in SELECT FOR UPDATE or atomic RPC

**H-14:** Type casting `(loan as any)` hides type errors in loan retrieval
- **Fix:** Type teams array properly; use runtime validation on shape

**H-15:** Club isolation not verified in `approvePlayerLoan` like other functions
- **Fix:** Verify `roster.club_id === authResult.data.clubId`

---

### 🟡 MEDIUM — Patch Required (9 findings)

| ID | Source | Title | Location | Action |
|----|--------|-------|----------|--------|
| M-1 | edge | Empty/whitespace-only names accepted in `createRoster`/`createTeam` | sparta/src/lib/actions/admin.ts:1627, 1897 | **PATCH** |
| M-2 | edge | Off-by-one in pagination — `getAuditLogsForAdmin` range logic | sparta/src/lib/actions/admin.ts:2869 | **PATCH** |
| M-3 | edge | `archiveRoster` does not cascade `is_archived=true` to child teams | sparta/src/lib/actions/admin.ts:1803-1869 | **PATCH** |
| M-4 | edge | Approval without loan existence check — orphaned loans possible | sparta/src/lib/actions/admin.ts:2510-2603 | **PATCH** |
| M-5 | blind | Unvalidated color_hex format — doesn't account for 3-digit hex | sparta/src/lib/actions/admin.ts:1061 | **PATCH** |
| M-6 | blind | Missing error handling for duplicate coach assignment — generic DATABASE_ERROR | sparta/src/lib/actions/admin.ts:2211-2228 | **PATCH** |
| M-7 | edge | Unused `existingAssignment` variable — query runs but result discarded | sparta/src/lib/actions/admin.ts:1285-1295 | **PATCH** |
| M-8 | blind | Missing authorization for loan approval in `approvePlayerLoan` | sparta/src/lib/actions/admin.ts:2514-2603 | **PATCH** |
| M-9 | auditor | `createRoster` function signature mismatch — missing clubId parameter | sparta/src/lib/actions/admin.ts:1613-1616 | **DECISION_NEEDED** |

**Details:**

**M-1:** Name validation only checks length, not whitespace
- **Fix:** Add `.trim()` validation or `.regex(/\S/)` to reject whitespace-only strings

**M-2:** Range calculation uses `.range(offset, offset + per_page - 1)` which may not match displayed page numbers
- **Fix:** Clarify pagination intent (is it 0-indexed or 1-indexed?) and document or adjust calculation

**M-3:** `archiveRoster` should soft-archive child teams per spec
- **Fix:** After archiving roster, update all teams: `UPDATE teams SET is_archived = true WHERE roster_id = ?`

**M-4:** `approvePlayerLoan` doesn't verify player exists in from_team
- **Fix:** Add check: `EXISTS(SELECT 1 FROM team_players WHERE team_id = from_team_id AND player_id = ?)`

**M-5:** Color hex regex `/^#[0-9A-F]{6}$/i` rejects valid 3-digit hex (#RGB), accepts lowercase but type hints show uppercase
- **Fix:** Update regex to `/^#([0-9A-F]{6}|[0-9A-F]{3})$/i` or decide on canonical format (6-digit uppercase only)

**M-6:** Duplicate coach error returns generic `DATABASE_ERROR` instead of specific "Treinador já está na equipa"
- **Fix:** Catch unique constraint error and return friendly message OR add app-level check first

**M-7:** `existingAssignment` query runs but result unused; app-layer check missing
- **Fix:** Either remove query or use result to validate constraint before insertion

**M-8:** `approvePlayerLoan` doesn't verify approver is principal coach (FR-ADMIN-4)
- **Fix:** Add: `EXISTS(SELECT 1 FROM team_coaches WHERE (team_id = from_team_id OR team_id = to_team_id) AND profile_id = auth.uid() AND role = 'principal')`

**M-9: DECISION_NEEDED**
- **Issue:** Spec says `createRoster(clubId, seasonId, name?)` but code derives clubId from auth
- **Trade-off:** 
  - Option A: Change signature to accept clubId parameter (matches spec, allows admin to create rosters for other clubs)
  - Option B: Keep derived clubId (simpler, prevents staff from managing other clubs' rosters, aligns with RLS principle)
- **Question for Antero:** Should staff be able to create rosters for multiple clubs, or only their own?

---

### 🟢 LOW — Patch Required (5 findings)

| ID | Source | Title | Location | Action |
|----|--------|-------|----------|--------|
| L-1 | edge | Unused `existingAssignment` result in `addPlayerToTeam` | sparta/src/lib/actions/admin.ts:1285-1295 | **PATCH** |
| L-2 | blind | `activeTeamsCount` off-by-one — should use `>=` not `>` | sparta/src/lib/actions/admin.ts:1318 | **PATCH** |
| L-3 | blind | Audit logging not awaited — fire-and-forget without error handling | sparta/src/lib/actions/admin.ts:1388-1403, etc. | **DEFER** |
| L-4 | blind | Missing season_id club validation in `createRoster` | sparta/src/lib/actions/admin.ts:1638-1649 | **PATCH** |
| L-5 | edge | Color hex accepts lowercase but type hints show uppercase | sparta/src/lib/actions/admin.ts:1061 | **DISMISS** (covered by M-5) |

**Details:**

**L-1:** Query for existing assignment runs but unused — constraint validation is incomplete
- **Fix:** Use result to block insertion if exists, or remove dead code

**L-2:** Off-by-one in senior team limit check
- **Evidence:** Counts active teams, then checks `activeTeamsCount > maxTeams` but should prevent adding when count would equal maxTeams
- **Fix:** Change to `>= maxTeams`

**L-3 (DEFER):** Audit logging is fire-and-forget by design (async without await); trade-off between action latency and audit reliability
- **Status:** Acceptable architectural decision if documented; defer unless error tracking is required

**L-4:** `createRoster` validates season_id exists but doesn't verify it belongs to the club
- **Fix:** Add: `AND season_id IN (SELECT id FROM seasons WHERE club_id = ?)`

**L-5:** Dismissed (duplicate of M-5)

---

## DEDUPLICATION SUMMARY

| Deduplicated Pair | Merged Into | Rationale |
|------------------|------------|-----------|
| blind SQL injection #1, #2 | C-1 | Same root cause — string interpolation |
| edge duplicate coach, blind duplicate coach | C-2 | Same issue, different discovery angle |
| blind race condition count+insert, edge concurrent add | H-13 | Overlapping race condition scenarios |
| edge "already loaned", auditor "already loaned" | H-6 | Identical requirement from two layers |
| edge "same team loan", auditor "same team loan" | H-7 | Identical requirement |
| edge color lowercase, blind color format | M-5 | Related format validation |
| blind activeTeamsCount, edge activeTeamsCount | L-2 | Same off-by-one issue |
| edge color hex (LOW), blind color hex (LOW) | L-5 → DISMISS | Duplicate, covered by M-5 |

**Original:** 41 findings → **Deduplicated:** 33 findings

---

## CLASSIFICATION SUMMARY

| Category | Count | Action |
|----------|-------|--------|
| **🔴 CRITICAL (patch)** | 4 | Must fix before merge |
| **🟠 HIGH (patch)** | 15 | Must fix before merge |
| **🟡 MEDIUM (patch)** | 8 | Should fix before merge |
| **🟡 MEDIUM (decision)** | 1 | Requires human input |
| **🟢 LOW (patch)** | 4 | Nice to fix |
| **🟢 LOW (defer)** | 1 | Acceptable as-is (fire-and-forget by design) |
| **DISMISS** | 1 | False positive / duplicate |
| **TOTAL ACTIONABLE** | 32 | |

---

## NEXT STEP

Proceed to **step-04-present** for formatted output and recommendations.
