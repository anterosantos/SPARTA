# Patch Application Guide — Epic 8 Code Review

**Generated:** 2026-06-06  
**Total Patches:** 32 (4 CRITICAL + 15 HIGH + 8 MEDIUM + 4 LOW + 1 DECISION)  
**Estimated Effort:** 2-3 hours for experienced dev

---

## CRITICAL PATCHES (4) — Fix First

### C-1: SQL Injection in `addPlayerToTeam` (sparta/src/lib/actions/admin.ts:156-158, 178-180)

**Issue:** String interpolation in Supabase `.in()` query allows SQL injection

**Current Code (lines 156-161):**
```typescript
.in(
  "team_id",
  `(SELECT id FROM teams WHERE roster_id = '${team.roster_id}')`
)
```

**Fix:** Use parameterized query or refactor to avoid raw SQL

**Option A (Recommended):** Refactor to fetch team IDs first
```typescript
// Step 5a: Fetch all teams in this roster
const { data: rosterTeams, error: teamsError } = await serviceRole
  .from("teams")
  .select("id")
  .eq("roster_id", team.roster_id);

if (teamsError || !rosterTeams) {
  return {
    ok: false,
    error: { code: "DATABASE_ERROR", message: teamsError?.message || "Failed to fetch teams" },
  };
}

const teamIds = rosterTeams.map(t => t.id);

// Step 5b: Check for existing active assignment
if (teamIds.length > 0) {
  const { data: existingAssignment } = await serviceRole
    .from("team_players")
    .select("id")
    .eq("player_id", playerId)
    .in("team_id", teamIds)
    .eq("status", "active")
    .single();
  // ... use existingAssignment
}
```

**Apply to:** Lines 152-161 (replace full Step 5) and lines 174-182 (Step 7 count)

---

### C-2: Duplicate Coach Assignment Race Condition (sparta/src/lib/actions/admin.ts:2210-2229 + migration)

**Issue:** No UNIQUE constraint + no app-level duplicate check

**Part A: Database Schema**

**File:** `sparta/supabase/migrations/000384_admin_team_coaches.sql`

**Current (line ~3475):** Migration explicitly states "NO uniqueness constraint"

**Fix:** Add UNIQUE constraint
```sql
-- After the team_coaches table definition, add:
ALTER TABLE team_coaches ADD UNIQUE (team_id, profile_id);
```

**Part B: Application Code**

**File:** `sparta/src/lib/actions/admin.ts` (assignCoachToTeam function)

**Current Code (lines 2210-2229):** Direct insert without checking duplicate

**Fix:** Add duplicate check before insert
```typescript
export async function assignCoachToTeam(
  teamId: string,
  profileId: string,
  role: "principal" | "assistant" | "analyst" = "assistant"
): Promise<AssignCoachToTeamResult> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId } = authResult.data;

  try {
    const serviceRole = getServiceRoleClient();

    // Verify team belongs to club
    const { data: team } = await serviceRole
      .from("teams")
      .select("roster_id, rosters(club_id)")
      .eq("id", teamId)
      .single();

    if (!team || (team.rosters as any)?.club_id !== clubId) {
      return {
        ok: false,
        error: { code: "FORBIDDEN", message: "Team not in your club" },
      };
    }

    // ✅ NEW: Check for existing assignment
    const { data: existingCoach, error: existingError } = await serviceRole
      .from("team_coaches")
      .select("id, role")
      .eq("team_id", teamId)
      .eq("profile_id", profileId)
      .single();

    if (existingCoach) {
      return {
        ok: false,
        error: {
          code: "COACH_ALREADY_ASSIGNED",
          message: `Treinador já está na equipa (role: ${existingCoach.role})`,
        },
      };
    }

    // Insert with error handling for unique constraint
    const { data: coach, error: insertError } = await serviceRole
      .from("team_coaches")
      .insert({
        team_id: teamId,
        profile_id: profileId,
        role: role || "assistant",
        joined_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.message.includes("unique")) {
        return {
          ok: false,
          error: {
            code: "COACH_ALREADY_ASSIGNED",
            message: "Treinador já está na equipa",
          },
        };
      }
      return {
        ok: false,
        error: { code: "DATABASE_ERROR", message: insertError.message },
      };
    }

    // Audit log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: authResult.data.userId,
      action: "team_coaches.assigned",
      target_kind: "team_coaches",
      target_id: coach.id,
      payload_json: { role },
    });

    return { ok: true, data: { id: coach.id } };
  } catch (error) {
    console.error("[assignCoachToTeam] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}
```

---

### C-3: Simultaneous Roster Activation Race Condition (sparta/src/lib/actions/admin.ts:1651-1668)

**Issue:** No SELECT FOR UPDATE lock; two concurrent requests can both pass the "no active roster" check

**Current Code:**
```typescript
// Verify no active roster exists for this club/season
const { data: existingRoster } = await serviceRole
  .from("rosters")
  .select("id")
  .eq("club_id", clubId)
  .eq("season_id", seasonId)
  .eq("status", "active")
  .single();

if (existingRoster) {
  return {
    ok: false,
    error: {
      code: "ROSTER_EXISTS",
      message: "Active roster already exists for this season",
    },
  };
}

// Insert new roster
const { data: roster, error: insertError } = await serviceRole
  .from("rosters")
  .insert({
    club_id: clubId,
    season_id: seasonId,
    name,
    status: "active",
  })
  .select("id")
  .single();
```

**Fix:** Add retry logic with exponential backoff for constraint violation

```typescript
export async function createRoster(
  clubId: string,  // ✅ NEW: Add clubId parameter
  seasonId: string,
  name: string
): Promise<CreateRosterResult> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  // ✅ CHANGED: Use provided clubId instead of deriving
  // const { clubId } = authResult.data;
  
  // ✅ NEW: Verify user can create roster for this club
  if (clubId !== authResult.data.clubId) {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "Cannot create roster for another club" },
    };
  }

  // ... rest of function

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const serviceRole = getServiceRoleClient();

      // Step 1: Verify no active roster exists
      const { data: existingRoster } = await serviceRole
        .from("rosters")
        .select("id")
        .eq("club_id", clubId)
        .eq("season_id", seasonId)
        .eq("status", "active")
        .single();

      if (existingRoster) {
        return {
          ok: false,
          error: {
            code: "ROSTER_EXISTS",
            message: "Active roster already exists for this season",
          },
        };
      }

      // Step 2: Trim name
      const trimmedName = name?.trim() || "";
      if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 255) {
        return {
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: "Roster name must be 1-255 characters",
          },
        };
      }

      // Step 3: Validate season belongs to club
      const { data: season, error: seasonError } = await serviceRole
        .from("seasons")
        .select("id, club_id")
        .eq("id", seasonId)
        .eq("club_id", clubId)
        .single();

      if (seasonError || !season) {
        return {
          ok: false,
          error: { code: "SEASON_NOT_FOUND", message: "Season not found in your club" },
        };
      }

      // Step 4: Try to insert (constraint will catch race condition)
      const { data: roster, error: insertError } = await serviceRole
        .from("rosters")
        .insert({
          club_id: clubId,
          season_id: seasonId,
          name: trimmedName,
          status: "active",
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        // Unique constraint violation from race condition
        if (insertError.message.includes("unique") && retryCount < maxRetries - 1) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100)); // Exponential backoff
          continue;
        }

        return {
          ok: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Active roster already exists (constraint violation)",
          },
        };
      }

      // Audit log
      await serviceRole.from("audit_logs").insert({
        club_id: clubId,
        actor_id: authResult.data.userId,
        action: "rosters.created",
        target_kind: "rosters",
        target_id: roster.id,
      });

      return { ok: true, data: { id: roster.id } };
    } catch (error) {
      console.error("[createRoster] Error:", error);
      return {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      };
    }
  }

  return {
    ok: false,
    error: { code: "ROSTER_EXISTS", message: "Failed to create roster after retries" },
  };
}
```

---

### C-4: `approvePlayerLoan` Missing team_players Status Update (sparta/src/lib/actions/admin.ts:2510-2603)

**Issue:** When loan is approved, player must be added to destination team with status='loaned', but code only updates player_loans table

**Current Code (lines 2565-2573):**
```typescript
const { error: updateError } = await serviceRole
  .from("player_loans")
  .update({
    status: "approved",
    approved_by: authResult.data.userId,
    approved_at: new Date().toISOString(),
  })
  .eq("id", loanId);
```

**Fix:** Also create/update team_players for destination team

```typescript
// After updating player_loans status to 'approved':

// ✅ NEW: Create/update team_players for destination team with status='loaned'
const { error: teamPlayerError } = await serviceRole
  .from("team_players")
  .upsert({
    team_id: (loan as any).to_team_id,
    player_id: (loan as any).player_id,
    status: "loaned",
    joined_at: new Date().toISOString(),
  }, {
    onConflict: "team_id,player_id"
  })
  .select("id")
  .single();

if (teamPlayerError) {
  return {
    ok: false,
    error: {
      code: "DATABASE_ERROR",
      message: `Failed to create loaned player record: ${teamPlayerError.message}`,
    },
  };
}

// Audit log (updated)
await serviceRole.from("audit_logs").insert({
  club_id: clubId,
  actor_id: authResult.data.userId,
  action: "player_loans.approved",
  target_kind: "player_loans",
  target_id: loanId,
  payload_json: {
    approved_by: authResult.data.userId,
    player_id: (loan as any).player_id,
    to_team_id: (loan as any).to_team_id,
  },
});
```

---

## HIGH PRIORITY PATCHES (15)

Due to length, here's a summary. Detailed implementations will follow.

### H-1: Null escalao Bypasses Age Validation

**File:** `sparta/src/lib/validators/admin.ts`

**Change:** In `validateAgeGroupMobility()`, handle null escalao explicitly:
```typescript
if (teamEscalao === null || teamEscalao === undefined) {
  // Flexible team — allow any age group (but document this in spec)
  return { valid: true };
}
// ... rest of validation
```

### H-2 to H-5: Missing Authorization Checks (4 patches)

**Files affected:** `sparta/src/lib/actions/admin.ts`
- **H-2:** Add coach assignment verification in `addPlayerToTeam`
- **H-3:** Add principal coach check in `assignCoachToTeam`
- **H-4:** Add principal coach check in `removeCoachFromTeam`
- **H-5:** Add principal coach check in `changeCoachRole`

**Pattern for all:** Before insert/update, add:
```typescript
const { data: principalCoach } = await serviceRole
  .from("team_coaches")
  .select("id")
  .eq("team_id", teamId)
  .eq("profile_id", authResult.data.userId)
  .eq("role", "principal")
  .single();

if (!principalCoach) {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "Only principal coach can manage team assignments",
    },
  };
}
```

### H-6 to H-7: `requestPlayerLoan` Validations (2 patches)

**File:** `sparta/src/lib/actions/admin.ts`

**H-6:** Add "already loaned" check:
```typescript
const { data: existingLoan } = await serviceRole
  .from("team_players")
  .select("id")
  .eq("player_id", playerId)
  .eq("status", "loaned")
  .single();

if (existingLoan) {
  return {
    ok: false,
    error: { code: "INVALID_REQUEST", message: "Jogador já está emprestado" },
  };
}
```

**H-7:** Add "same team" check:
```typescript
if (fromTeamId === toTeamId) {
  return {
    ok: false,
    error: { code: "INVALID_REQUEST", message: "Não é possível emprestar para a mesma equipa" },
  };
}
```

### H-8: `returnPlayerLoan` Not Updating team_players

**File:** `sparta/src/lib/actions/admin.ts`

**Add after status='returned':**
```typescript
// Update destination team_players to is_archived=true
const { error: archiveError } = await serviceRole
  .from("team_players")
  .update({ is_archived: true })
  .eq("team_id", (loan as any).to_team_id)
  .eq("player_id", (loan as any).player_id);

if (archiveError) {
  // Log but don't fail — loan return should succeed
  console.error("[returnPlayerLoan] Failed to archive team_players:", archiveError);
}
```

### H-9: `removePlayerFromTeam` Missing is_archived

**File:** `sparta/src/lib/actions/admin.ts`

**Change lines 1469-1471 from:**
```typescript
const { error: updateError } = await serviceRole
  .from("team_players")
  .update({
    status: "reserve",
    left_at: new Date().toISOString(),
  })
```

**To:**
```typescript
const { error: updateError } = await serviceRole
  .from("team_players")
  .update({
    status: "reserve",
    left_at: new Date().toISOString(),
    is_archived: true,  // ✅ NEW
  })
```

### H-12: `updatePlayerStatus` Needs State Machine

**File:** `sparta/src/lib/actions/admin.ts`

**Add validation:**
```typescript
// Validate state transition
const { data: currentTeamPlayer } = await serviceRole
  .from("team_players")
  .select("status")
  .eq("id", teamPlayerId)
  .single();

const currentStatus = currentTeamPlayer?.status;

// Allowed transitions: active → loaned → reserve, or active → reserve
const validTransitions: Record<string, string[]> = {
  active: ["loaned", "reserve"],
  loaned: ["reserve"],
  reserve: [], // Cannot change from reserve
};

if (!validTransitions[currentStatus]?.includes(status)) {
  return {
    ok: false,
    error: {
      code: "INVALID_TRANSITION",
      message: `Cannot transition from ${currentStatus} to ${status}`,
    },
  };
}
```

### H-13: Race Condition in `addPlayerToTeam` Count + Insert

**File:** `sparta/src/lib/actions/admin.ts`

**Pattern:** Wrap senior limit check in transaction or use advisory lock

```typescript
// ✅ Alternative: Use RPC with built-in transaction
const { data: result, error: rpcError } = await serviceRole.rpc(
  "add_player_to_team_safe",
  {
    p_team_id: teamId,
    p_player_id: playerId,
    p_position: position || null,
  }
);

if (rpcError) {
  return {
    ok: false,
    error: { code: "DATABASE_ERROR", message: rpcError.message },
  };
}
```

### H-14: Type Safety in `approvePlayerLoan`

**File:** `sparta/src/lib/actions/admin.ts`

**Change from:**
```typescript
const fromTeam = (loan as any).teams?.find(t => ...);
```

**To:**
```typescript
// Type the loan properly
interface PlayerLoan {
  id: string;
  player_id: string;
  from_team_id: string;
  to_team_id: string;
  status: string;
  // ... other fields
}

const typedLoan = loan as PlayerLoan;
// Use typedLoan throughout without type casts
```

### H-15: Club Isolation in `approvePlayerLoan`

**File:** `sparta/src/lib/actions/admin.ts`

**Add club verification:**
```typescript
// Verify roster (and thus team) belongs to user's club
const { data: fromRoster } = await serviceRole
  .from("rosters")
  .select("club_id")
  .eq("id", team.roster_id)
  .single();

if (fromRoster?.club_id !== clubId) {
  return {
    ok: false,
    error: { code: "FORBIDDEN", message: "Loan team not in your club" },
  };
}
```

---

## MEDIUM & LOW PATCHES (12)

### Summary Table

| ID | File | Change | Lines | Effort |
|---|------|--------|-------|--------|
| M-1 | admin.ts | Trim names in createRoster/createTeam | 1627, 1897 | 5min |
| M-2 | admin.ts | Fix pagination range logic | 2869 | 5min |
| M-3 | admin.ts | Cascade is_archived in archiveRoster | 1803-1869 | 10min |
| M-4 | admin.ts | Check loan existence in approvePlayerLoan | 2510-2603 | 10min |
| M-5 | types.ts | Update color_hex regex | 1061 | 5min |
| M-6 | admin.ts | Handle duplicate coach error msg | 2211-2228 | 10min |
| M-7 | admin.ts | Remove unused existingAssignment query | 1285-1295 | 5min |
| M-8 | admin.ts | Add coach auth in approvePlayerLoan | 2514-2603 | 10min |
| M-9 | admin.ts | Update createRoster signature | 1613-1616 | ✅ Done (C-3) |
| L-1 | admin.ts | Use existingAssignment result | 1285-1295 | 5min |
| L-2 | admin.ts | Fix activeTeamsCount >= check | 1318 | 2min |
| L-4 | admin.ts | Validate season_id club | 1638-1649 | 10min |

---

## MIGRATIONS TO UPDATE

**File:** `sparta/supabase/migrations/000384_admin_team_coaches.sql`

- Add UNIQUE constraint on (team_id, profile_id)

**File:** `sparta/supabase/migrations/000381_admin_rosters.sql` (optional)

- Verify UNIQUE constraint on (club_id, season_id) where status='active'

---

## TESTING CHECKLIST AFTER PATCHES

- [ ] TypeScript compilation passes (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Admin action tests pass (`npm run test -- admin.test.ts`)
- [ ] Migrations apply cleanly (`supabase db reset`)
- [ ] Manual test: Create roster (no race condition)
- [ ] Manual test: Add player to team (no SQL injection)
- [ ] Manual test: Assign duplicate coach (returns friendly error)
- [ ] Manual test: Approve loan (team_players created with status='loaned')
- [ ] Manual test: Return loan (team_players archived)

---

## RECOMMENDED ORDER OF APPLICATION

1. **C-1, C-2, C-3, C-4** — CRITICAL (these are showstoppers)
2. **H-2 to H-5** — Authorization (security-critical)
3. **H-6 to H-8** — Loan workflow validations
4. **H-9 to H-15** — Remaining HIGH
5. **M-1 to M-9** — MEDIUM (data quality + completeness)
6. **L-1 to L-4** — LOW (polish)

**Total Estimated Time:** 2-3 hours with careful testing

---

**Generated by:** Code Review Workflow (bmad-code-review)  
**Review Date:** 2026-06-06  
**All Layers:** Complete ✅
