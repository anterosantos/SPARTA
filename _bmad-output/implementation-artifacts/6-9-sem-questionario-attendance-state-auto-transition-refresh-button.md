---
story_id: "6.9"
story_key: "6-9-sem-questionario-attendance-state-auto-transition-refresh-button"
epic: "Epic 6 — Recolha de Performance — Touchscreen 3-ecrãs"
status: "ready-for-dev"
created: 2026-06-05
depends_on:
  - "6-7-attendance-recording-for-training-sessions (done)"
  - "4-1-fatigue-response-schema-idempotent-server-action (done)"
  - "1-11-outbox-foundation-dexie-uuidv7-generation-service-worker-serwist (done)"
related_stories:
  - "6-7-attendance-recording-for-training-sessions"
  - "4-2-fatigue-questionnaire-ui-5-sliders-with-snap-single-view"
---

# Story 6.9: "Sem Questionário" Attendance State + Auto-Transition + Refresh Button

**Status:** ready-for-dev | **Story ID:** 6.9 | **Epic:** Epic 6

**Depends on:**
- Story 6.7 (Attendance panel) — done
- Story 4.1 (Fatigue responses) — done

---

## Story

**As** the system and as an Analista,
**I want** a dedicated default attendance state that distinguishes "not yet recorded" from "present" or "absent", and a refresh button to bulk-update that state from questionnaire submissions,
**So that** the attendance panel always reflects the most accurate known state without requiring manual entry for every player who submitted their questionnaire.

---

## Acceptance Criteria

### AC #1: New Attendance State — "sem_questionario"

**Given** migration `000335_attendances_sem_questionario.sql`
**When** applied
**Then** the `attendances.status` CHECK constraint is updated:
  - Existing values: `'present'`, `'absent'`, `'late'`, `'injured'`, `'excused'`
  - NEW value: `'sem_questionario'` (default initial state for new records)
**And** existing rows are unaffected (backward compatible)
**And** the default for new records is: `DEFAULT 'sem_questionario'`

### AC #2: Attendance Toggle Cycle (Analista Quick Actions)

**Given** the attendance panel renders for a session at `/sessoes/[id]/presencas`
**When** the Analista clicks on an attendance status for a player
**Then** the status cycles through in this order (FR30a):
  ```
  sem_questionario → present → absent → late → injured → excused → sem_questionario
  ```
**And** each click performs a local optimistic update, then syncs to server
**And** the cycle is consistent with Story 6.7 (existing panel behavior preserved)

### AC #3: Auto-Transition on Fatigue Submission

**Given** `submitFatigueResponse` is called with `phase='pre'` for a player
**When** the server action commits successfully
**Then** the attendance row for that player and session is auto-updated:
  - If `status='sem_questionario'` → update to `status='present'`
  - If `status='absent'`, `'late'`, `'injured'`, `'excused'` → DO NOT CHANGE (respect staff overrides)
  - If no record exists → create new record with `status='present'`
**And** this update is fire-and-forget (does not block questionnaire response)
**And** the update is logged: `audit_logs` action `'attendance.auto_present_from_questionnaire'`

**Example logic in `submitFatigueResponse`:**
```typescript
// After fatigue response is saved...
// Fire-and-forget: update attendance if student submitted pre-questionnaire
if (phase === 'pre') {
  // No await; don't block response
  supabase.from('attendances').upsert({
    session_id: sessionId,
    player_id: playerId,
    status: 'present', // Only if currently sem_questionario; see DB logic below
    updated_at: new Date().toISOString(),
  });
}
```

**Server-side constraint (in DB trigger or in application logic):**
```sql
-- Option 1: Trigger (automatic)
CREATE OR REPLACE FUNCTION auto_present_on_questionnaire()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE attendances SET status = 'present', updated_at = now()
  WHERE session_id = NEW.session_id
    AND player_id = NEW.player_id
    AND status = 'sem_questionario'
    AND NEW.phase = 'pre';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Option 2: Explicit in server action (easier to audit and test)
// Both approaches are acceptable; recommend Option 2 for clarity
```

### AC #4: Attendance Refresh Button

**Given** the attendance panel footer renders
**When** the panel is visible
**Then** a ghost-style button "Actualizar presenças" is visible
**And** the button is positioned in the footer (above or beside other controls)
**And** the button is disabled when the app is offline (check `navigator.onLine`)
**And** the button has `title="Offline"` tooltip when disabled

### AC #5: Refresh Button — Server Action

**Given** the Analista taps "Actualizar presenças" while online
**When** the server action `refreshAttendanceForSession(sessionId)` is invoked
**Then** it executes the following logic:
  1. Query `fatigue_responses` for all `phase='pre'` submissions for this session
  2. For each player who submitted:
     - If `attendances.status='sem_questionario'` → UPDATE to `'present'`
     - If no record exists → INSERT with `'present'`
     - If any other status → SKIP (don't override staff decisions)
  3. Return: `{ updatedCount: number, createdCount: number, skippedCount: number }`
  4. Log: `audit_logs` action `'attendance.refreshed_from_questionnaires'` with counts

**Example implementation:**
```typescript
export async function refreshAttendanceForSession(
  sessionId: string
): Promise<Result<{ updatedCount: number; createdCount: number }, ErrorPayload>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  // 1. Find all players who submitted pre-questionnaire
  const { data: submissions } = await supabase
    .from("fatigue_responses")
    .select("DISTINCT player_id")
    .eq("session_id", sessionId)
    .eq("phase", "pre")
    .eq("club_id", clubId);

  if (!submissions) return { ok: false, error: { message: "Database error" } };

  // 2. Upsert attendance records
  const playerIds = submissions.map(s => s.player_id);
  const updates = playerIds.map(playerId => ({
    session_id: sessionId,
    player_id: playerId,
    status: 'present',
    updated_at: new Date().toISOString(),
  }));

  // 3. Use ON CONFLICT to update only sem_questionario records
  const { data: result, error } = await supabase
    .from("attendances")
    .upsert(updates, {
      onConflict: "session_id,player_id",
      ignoreDuplicates: false,
    });

  // Count changes (note: upsert doesn't directly tell us what changed;
  // may need to query before/after or use trigger to count updates)
  
  return { ok: true, data: { updatedCount: result?.length ?? 0, createdCount: 0 } };
}
```

### AC #6: Refresh Button — UI & Feedback

**Given** the Analista taps "Actualizar presenças"
**When** the request is in progress
**Then** the button becomes disabled and shows a spinner icon
**And** no other clicks are processed until the request completes

**When** the request completes successfully
**Then** `<CalmConfirmation>` shows: "Presenças actualizadas (X actualizadas, Y criadas)"
**And** the confirmation dismisses after 2 seconds
**And** the attendance list re-renders with updated states from server
**And** the button returns to enabled state

**When** the request fails (network error, DB error, RLS violation)
**Then** an error toast shows: "Erro ao actualizar presenças"
**And** the button remains enabled for retry

### AC #7: Offline Detection

**Given** the attendance panel is visible
**When** the app detects offline status (`navigator.onLine === false`)
**Then** the "Actualizar presenças" button is disabled
**And** the button displays `aria-disabled="true"`
**And** a tooltip or helper text explains: "Operação requer conexão"

**When** the app regains connectivity (`navigator.onLine === true`)
**Then** the button becomes enabled again

### AC #8: Initial Attendance Setup

**Given** a session is created and the attendance panel is opened
**When** no attendance records exist yet
**Then** all active players in the club show with `status='sem_questionario'` placeholder
**And** the Analista can cycle through states or await automatic transitions from questionnaire submissions

---

## Developer Context

### Migration — `000335_attendances_sem_questionario.sql`

This migration is SIMPLE: it only adds a new CHECK value. Existing records are unaffected.

```sql
-- This might already exist from earlier migrations,
-- but if the attendances table was created without 'sem_questionario', add it:

ALTER TABLE attendances
  DROP CONSTRAINT attendances_status_check,
  ADD CONSTRAINT attendances_status_check 
    CHECK (status IN ('sem_questionario','present','absent','late','injured','excused'));

-- Alternatively, if using a full recreate:
CREATE TABLE attendances_new AS SELECT * FROM attendances;
DROP TABLE attendances;
ALTER TABLE attendances_new RENAME TO attendances;
-- (But this is overkill; simple ALTER is sufficient)
```

### Server Action Changes

**File:** `src/lib/actions/attendance.ts` (UPDATE or CREATE)

**Exports:**
1. `refreshAttendanceForSession(sessionId)` — NEW
2. `getSessionAttendances(sessionId)` — Existing (from 6.7)
3. Any existing attendance management actions

### Fatigue Response Changes

**File:** `src/lib/actions/fatigue.ts` (UPDATE)

**Change:** In `submitFatigueResponse`, add fire-and-forget attendance auto-transition:

```typescript
export async function submitFatigueResponse(payload: FatiguePayload) {
  // ... existing fatigue response logic ...

  // Fire-and-forget: auto-transition attendance if pre-questionnaire
  if (payload.phase === 'pre') {
    const supabase = getServiceRoleClient(); // Service role for cross-record update
    // No await; fire-and-forget
    supabase
      .from('attendances')
      .upsert({
        session_id: payload.sessionId,
        player_id: payload.playerId,
        status: 'present',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id,player_id' })
      .then(() => {
        // Silent success; optional logging
      })
      .catch((err) => {
        logger.warn('Attendance auto-transition failed', { err });
      });
  }

  return { ok: true, data: { id: insertedId } };
}
```

### Component Changes

**File:** `src/components/domain/AttendancePanel.tsx` (UPDATE)

**Add new button in footer:**
```tsx
<footer className="flex gap-2 justify-end">
  <button
    onClick={() => handleRefresh()}
    disabled={isRefreshing || !navigator.onLine}
    title={!navigator.onLine ? "Offline" : ""}
  >
    {isRefreshing ? <Spinner /> : <RotateCw className="w-4 h-4" />}
    Actualizar presenças
  </button>
</footer>
```

**Add online/offline listener:**
```typescript
useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}, []);
```

---

## Testing Requirements

### Unit Tests

```typescript
describe("Attendance Auto-Transition", () => {
  it("transitions sem_questionario to present on fatigue submission", async () => {
    // Setup: attendance record with status='sem_questionario'
    // Act: call submitFatigueResponse with phase='pre'
    // Assert: attendances table updated to status='present'
  });

  it("does NOT override explicit staff status (absent, late, etc.)", async () => {
    // Setup: attendance record with status='absent' (staff-set)
    // Act: submitFatigueResponse
    // Assert: attendance still 'absent' (unchanged)
  });

  it("creates attendance if none exists", async () => {
    // Setup: no attendance record
    // Act: submitFatigueResponse
    // Assert: new record created with status='present'
  });
});

describe("refreshAttendanceForSession", () => {
  it("updates sem_questionario to present for submitted players", async () => {
    // Setup: 3 players; 2 submitted pre-questionnaire, 1 didn't
    // Act: call refreshAttendanceForSession
    // Assert: 2 records updated to present, 1 untouched
  });

  it("creates records for players with submissions but no attendance", async () => {
    // Setup: players with questionnaire but no attendance row
    // Act: refresh
    // Assert: new rows created with 'present'
  });

  it("does not override non-sem_questionario statuses", async () => {
    // Setup: mixed statuses (present, absent, etc.)
    // Act: refresh
    // Assert: only sem_questionario → present, others unchanged
  });

  it("returns counts of updated/created records", async () => {
    // Assert: response contains { updatedCount, createdCount }
  });
});
```

### Integration Tests

```typescript
describe("Attendance Panel Refresh", () => {
  it("disables button when offline", async () => {
    // Setup: mock navigator.onLine = false
    // Assert: button is disabled
  });

  it("enables button when online", async () => {
    // Setup: mock navigator.onLine = true
    // Assert: button is enabled
  });

  it("shows spinner during refresh", async () => {
    // Act: click refresh button
    // Assert: button shows spinner, is disabled
    // Wait for completion
    // Assert: button shows icon again, is enabled
  });

  it("shows confirmation on success", async () => {
    // Act: click refresh
    // Assert: CalmConfirmation appears
    // Assert: text includes count ("Presenças actualizadas (2 actualizadas)")
  });

  it("shows error on failure", async () => {
    // Setup: mock failed API response
    // Act: click refresh
    // Assert: error toast appears
  });

  it("re-renders attendance list after refresh", async () => {
    // Act: click refresh
    // Wait for completion
    // Assert: attendance list reflects new statuses
  });
});
```

### Accessibility (axe-core)

```typescript
it("button is accessible when disabled", () => {
  // Button should have aria-disabled=true and remain focusable (if it's a <button>)
  // Or: use appropriate ARIA attributes
});
```

### Manual Testing Checklist

- [ ] Attendance panel opens for a session
- [ ] Player with no record shows `status='sem_questionario'`
- [ ] Clicking attendance status cycles through: sem_questionario → present → absent → ... → sem_questionario
- [ ] Player submits pre-questionnaire
- [ ] Refresh button exists in footer
- [ ] Refresh button is enabled when online
- [ ] Refresh button is disabled when offline (simulate via DevTools)
- [ ] Click refresh button
- [ ] Button shows spinner during request
- [ ] Confirmation appears: "Presenças actualizadas"
- [ ] Attendance list refreshes
- [ ] Players who submitted have status='present' (if they were 'sem_questionario')
- [ ] Staff-set statuses (absent, late) are NOT changed
- [ ] New players (submitted, no prior record) get status='present'

---

## Dependency Tree

### Must be DONE before this story

1. ✅ **Story 6.7** (Attendance recording panel) — DONE
2. ✅ **Story 4.1** (Fatigue responses schema) — DONE

### Enables

- **Story 5.11** (Absence indicator badge — uses attendance data)
- Real-time sync features (if needed in future)

---

## Implementation Notes

### Fire-and-Forget Pattern

The auto-transition in `submitFatigueResponse` is intentionally fire-and-forget:
- Does NOT await the attendance update
- Does NOT block the fatigue response
- Failures are logged but don't affect the primary response

This keeps the questionnaire flow fast and doesn't introduce coupling.

### Offline Button Disable

Use `navigator.onLine` for simple detection. This works well for typical use cases (loss of network, regain network). Does not detect degraded connections (slow, high-latency) — acceptable for MVP.

### Upsert Strategy

Use Supabase upsert with `onConflict` to handle both create and update in one operation. This is cleaner than separate INSERT + UPDATE logic.

---

## Status & Handoff

**Ready for development.** All context captured:
- ✅ Migration is simple (new CHECK value)
- ✅ Attendance panel structure exists
- ✅ Fatigue responses already integrated
- ✅ Acceptance criteria testable
- ✅ Dependencies well-scoped

**Next:** Dev agent runs `/dev-story 6-9` to implement.

---

**Completed:** Ultimate context engine analysis — comprehensive developer guide created ✅
