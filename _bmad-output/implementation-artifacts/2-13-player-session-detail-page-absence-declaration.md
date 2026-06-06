---
story_id: "2.13"
story_key: "2-13-player-session-detail-page-absence-declaration"
epic: "Epic 2 — Plantel, Calendário & Sessões"
status: "ready-for-dev"
created: 2026-06-05
depends_on:
  - "2-12-player-calendar-read-only-view-jogador"
  - "2-6-session-management-create-edit-cancel-treino-jogo-amigavel (done)"
  - "1-8-design-system-foundation-tokens-7-pattern-components-button-hierarchy (done)"
  - "1-5-email-password-authentication-password-recovery (done)"
related_stories:
  - "2-12-player-calendar-read-only-view-jogador"
  - "6-7-attendance-recording-for-training-sessions (done)"
---

# Story 2.13: Player Session Detail Page & Absence Declaration

**Status:** ready-for-dev

**Story ID:** 2.13

**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)

**Depends on:** 
- Story 2.12 (player calendar view — backlog, but creates link to this story)
- Story 2.6 (session data structure — done)
- Story 1.8 (design system — done)

**UX Reference:** Session detail display with absence declaration form

---

## Story

**As a** Jogador,
**I want to** tap a session in my calendar to see its details and declare my absence with an optional justification,
**So that** the staff is informed of my absence in advance without requiring a phone call or message.

---

## Acceptance Criteria

### AC #1: Route & Navigation from Calendar

**Given** a Jogador is in the player calendar (`/calendario`)
**When** they tap a session block
**Then** the route `/agenda/[sessionId]` opens
**And** the page is within the `(player)` route group with the player layout
**And** the URL is shareable and survives reload

### AC #2: Session Detail Display

**Given** the session detail page renders
**When** the data loads
**Then** the following information is displayed:
  - Session type (e.g., "Treino", "Jogo", "Jogo Amigável")
  - Date formatted in PT-PT locale (e.g., "sábado, 6 de junho")
  - Time formatted in PT-PT timezone (e.g., "11:00")
  - Location (if set; or "Local não definido" if null)
  - Duration in minutes (if set; or "-" if null)
**And** all timestamps use `Europe/Lisbon` timezone explicitly
**And** the page header displays the session type with appropriate styling/color (from Story 2.11 design)

### AC #3: Attendance Status Detection

**Given** the player loads the session detail page
**When** the server action `getPlayerAttendanceForSession(sessionId)` executes
**Then** it returns:
  - `status`: one of 'sem_questionario', 'present', 'absent', 'late', 'injured', 'excused'
  - `note`: nullable string (justification for absence, max 500 chars)
**And** if no attendance record exists, it returns `status='sem_questionario'` (default)

### AC #4: Declare Absence — UI & Interaction

**Given** the player's attendance status is 'sem_questionario' or no record exists
**When** the page renders
**Then** a primary button "Declarar ausência" is visible
**And** below the button, an optional textarea is visible with:
  - Label: "Justificação (opcional)"
  - Placeholder: "Ex: lesão, doença, compromisso pessoal"
  - Max 500 characters
  - Character counter below the textarea: "X/500 caracteres"
  - Initial state: empty

**Given** the player enters text into the textarea
**When** the character count exceeds 500
**Then** the textarea border turns red (error state)
**And** the "Declarar ausência" button is disabled
**And** an inline error message appears: "Máximo 500 caracteres"

### AC #5: Declare Absence — Server Action

**Given** the player taps "Declarar ausência"
**When** the client calls `declarePlayerAbsence(sessionId, note: string | null)`
**Then** the server action:
  1. Validates that the calling user is the player (`auth.uid()`)
  2. Validates that `note` is null or ≤500 characters (Zod schema)
  3. Upserts into `attendances` table:
     - `session_id = sessionId`
     - `player_id = auth.uid()`
     - `status = 'absent'`
     - `note = note ?? null`
  4. Returns `Result<Attendance, ErrorPayload>` with updated record
  5. Logs to `audit_logs` with action 'attendance.declared_absence' (FR21a context)

**And** on success:
  - `<CalmConfirmation>` component shows: "Ausência registada" with icon checkmark
  - Confirmation dismisses automatically after 2 seconds
  - Button text changes to "Cancelar ausência"

### AC #6: Cancel Absence — UI & Interaction

**Given** the player's attendance status is 'absent'
**When** the page renders
**Then** the button label changes to "Cancelar ausência"
**And** the textarea displays the previously-entered note (read-only or editable — see AC #7)
**And** the character counter still displays below

### AC #7: Cancel Absence — Server Action

**Given** the player taps "Cancelar ausência"
**When** the client calls `cancelPlayerAbsence(sessionId)`
**Then** the server action:
  1. Validates that the calling user is the player
  2. Updates `attendances` record:
     - Sets `status = 'sem_questionario'` (reset to default)
     - Clears `note = null`
  3. Returns `Result<Attendance, ErrorPayload>`
  4. Logs to `audit_logs` with action 'attendance.cancelled_absence'

**And** on success:
  - `<CalmConfirmation>` shows: "Ausência cancelada"
  - Button text reverts to "Declarar ausência"
  - Textarea clears

### AC #8: Role Enforcement

**Given** a staff member (coach/analyst) navigates to `/agenda/[sessionId]`
**When** the middleware checks role
**Then** the request is redirected to the staff session detail route (not this player route)
**And** no player data is leaked to staff through this route

### AC #9: Isolation — Player Can Only Edit Own Attendance

**Given** player A tries to call `declarePlayerAbsence(sessionId, note)` for player B
**When** the server action validates `auth.uid()`
**Then** the request fails with error: "Sem permissão"
**And** no attendance record is modified
**And** the action is logged as 'attendance.unauthorized_attempt'

### AC #10: Form Validation (UX-DR31)

**Given** the textarea contains invalid content (e.g., > 500 chars)
**When** the player taps "Declarar ausência"
**Then** client-side validation prevents submission
**And** the server action also validates (defense-in-depth) and returns error if needed
**And** the error message is user-friendly: "Máximo 500 caracteres"

### AC #11: Accessibility (NFR36)

**Given** the session detail page renders
**When** testing with axe-core
**Then** the following are true:
  - The textarea has a visible `<label>` associated via `htmlFor`
  - The textarea has `aria-describedby` pointing to the character counter
  - Button text is descriptive: "Declarar ausência" (not "Submit")
  - The page title is descriptive in the tab
  - All interactive elements are keyboard-accessible (Tab, Enter)
**And** zero axe violations reported

### AC #12: Empty State (Edge Case)

**Given** the session has been cancelled or deleted
**When** the player navigates to `/agenda/[sessionId]`
**Then** either:
  - The page displays "Sessão cancelada ou removida"
  - Or the page redirects to `/calendario` with an error toast
**And** no attendance interface is rendered for cancelled sessions

---

## Developer Context

### Route Structure & File Locations

**NEW Route:**
- `(player)/agenda/[sessionId]/page.tsx` — Player session detail page

**NEW Server Actions (in new file):**
- `lib/actions/player-attendance.ts` — Three exports:
  - `getPlayerAttendanceForSession(sessionId: string)`
  - `declarePlayerAbsence(sessionId: string, note: string | null)`
  - `cancelPlayerAbsence(sessionId: string)`

**NEW Components (if extracted):**
- `components/domain/SessionDetailCard.tsx` — Display session info (optional)
- `components/domain/AbsenceDeclarationForm.tsx` — Textarea + button logic (optional)

### Data Flow

```
Player calendar `/calendario`
  → taps session block
    → navigates to `/agenda/[sessionId]`
      → Server Component `page.tsx`
        → calls `getPlayerAttendanceForSession(sessionId)`
          → returns current attendance status
        → renders `<SessionDetailCard/>` with session data
        → renders `<AbsenceDeclarationForm/>` with current status
          → on button click → `declarePlayerAbsence()` or `cancelPlayerAbsence()`
            → updates DB
            → returns updated status
            → re-renders form with new state
            → shows `<CalmConfirmation/>`
```

### Attendance Table Schema

Already exists (from Story 2.6 migration `000090_attendances.sql` or similar):

```sql
CREATE TABLE attendances (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text CHECK (status IN ('sem_questionario','present','absent','late','injured','excused')) NOT NULL DEFAULT 'sem_questionario',
  note text CHECK (length(note) <= 500) -- NULL OK
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**RLS Policy:** 
- Player can SELECT/INSERT/UPDATE their own attendance records (`player_id = auth.uid()`)
- Staff can SELECT/UPDATE all records for their club (via `session_id → sessions.club_id`)

### Server Action — `getPlayerAttendanceForSession`

**Signature:**
```typescript
export async function getPlayerAttendanceForSession(
  sessionId: string
): Promise<Result<{ status: AttendanceStatus; note: string | null }, ErrorPayload>>
```

**Logic:**
1. Get authenticated user: `const { data: { user } } = await supabase.auth.getUser()`
2. If not authenticated → return error
3. Query `attendances` where `session_id = sessionId AND player_id = auth.uid()`
4. If no record → return default `{ status: 'sem_questionario', note: null }`
5. If record exists → return `{ status: record.status, note: record.note }`

**RLS:** Relies on existing policy allowing player to read own records.

### Server Action — `declarePlayerAbsence`

**Signature:**
```typescript
export async function declarePlayerAbsence(
  sessionId: string,
  note: string | null
): Promise<Result<Attendance, ErrorPayload>>
```

**Zod Validation:**
```typescript
const schema = z.object({
  sessionId: z.string().uuid(),
  note: z.string().max(500).nullable().optional(),
});
```

**Logic:**
1. Validate input with Zod
2. Get authenticated user
3. Check user role is 'player' (optional extra safety; RLS enforces this)
4. Upsert into `attendances`:
   ```sql
   INSERT INTO attendances (session_id, player_id, status, note)
   VALUES ($1, $2, 'absent', $3)
   ON CONFLICT (session_id, player_id) DO UPDATE SET
     status = 'absent', note = $3, updated_at = now()
   ```
5. Audit log: `{ action: 'attendance.declared_absence', target_kind: 'attendance', target_id: record.id, actor_id: auth.uid() }`
6. Return updated record

**Error Cases:**
- Unauthenticated → 401
- Invalid sessionId → "Sessão não encontrada"
- Note > 500 chars → "Máximo 500 caracteres"
- RLS violation → "Sem permissão" (generic, doesn't leak reason)

### Server Action — `cancelPlayerAbsence`

**Signature:**
```typescript
export async function cancelPlayerAbsence(
  sessionId: string
): Promise<Result<Attendance, ErrorPayload>>
```

**Logic:**
1. Get authenticated user
2. Update `attendances` where `session_id = sessionId AND player_id = auth.uid()`:
   ```sql
   UPDATE attendances
   SET status = 'sem_questionario', note = NULL, updated_at = now()
   WHERE session_id = $1 AND player_id = $2
   ```
3. Audit log: `{ action: 'attendance.cancelled_absence', ... }`
4. Return updated record

### Client Component — `AbsenceDeclarationForm`

**Props:**
```typescript
interface AbsenceDeclarationFormProps {
  sessionId: string;
  initialStatus: 'sem_questionario' | 'absent' | 'late' | 'injured' | 'excused';
  initialNote: string | null;
  onSuccess?: () => void;
}
```

**State Management:**
- Local state for textarea input: `[note, setNote]`
- Loading state during submission: `[isSubmitting, setIsSubmitting]`
- Error state: `[error, setError]`
- Show confirmation: `[showConfirmation, setShowConfirmation]`

**Rendering:**
- If `status !== 'sem_questionario'` and `status !== 'absent'` → render read-only message: "Estado: Presente | Atrasado | Lesionado | Justificado"
- If `status === 'sem_questionario'` or `status === 'absent'`:
  - Button with appropriate label (declare vs. cancel)
  - Textarea (if declaring)
  - Character counter with validation
  - Error message if > 500 chars

**Example Conditional:**
```typescript
const canDeclareAbsence = ['sem_questionario', 'absent'].includes(initialStatus);

if (!canDeclareAbsence) {
  return <p>Estado: {translateStatus(initialStatus)}</p>;
}

return (
  <>
    <textarea
      maxLength={500}
      value={note}
      onChange={(e) => setNote(e.target.value)}
      disabled={isSubmitting}
    />
    <small>{note.length}/500</small>
    {note.length > 500 && <p className="error">Máximo 500 caracteres</p>}
    <button
      onClick={() => handleSubmit()}
      disabled={isSubmitting || note.length > 500}
    >
      {initialStatus === 'absent' ? 'Cancelar ausência' : 'Declarar ausência'}
    </button>
  </>
);
```

### Server Component — `page.tsx`

**Structure:**
```typescript
export const metadata = { title: "Detalhe da Sessão" };

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  // 1. Auth check
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Verify role is player (middleware should handle this)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "player") redirect("/");

  // 3. Fetch session details
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, club_id, type, scheduled_at, location, duration_min")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return <EmptyState>Sessão não encontrada</EmptyState>;
  }

  // 4. Verify player belongs to this club (safety check; RLS should block anyway)
  const { data: player } = await supabase
    .from("players")
    .select("club_id")
    .eq("profile_id", user.id)
    .single();

  if (!player || player.club_id !== session.club_id) {
    redirect("/");
  }

  // 5. Fetch player's attendance status
  const attendanceResult = await getPlayerAttendanceForSession(sessionId);
  const attendance = attendanceResult.ok
    ? attendanceResult.data
    : { status: 'sem_questionario', note: null };

  // 6. Render
  return (
    <main className="flex flex-col gap-4">
      <SessionDetailCard session={session} />
      <AbsenceDeclarationForm
        sessionId={sessionId}
        initialStatus={attendance.status}
        initialNote={attendance.note}
      />
    </main>
  );
}
```

---

## Technical Requirements

### Routing & Middleware

- Player route `/agenda/[sessionId]` must be under `(player)` route group
- Middleware must redirect non-players away (verify in `src/middleware.ts`)
- Route should be protected by auth middleware (redirect to login if not authenticated)

### Database & RLS

- Attendances table already exists with proper RLS
- No new migrations required
- Player can only see/modify their own records

### Form Validation

- Client-side: Zod schema validation
- Server-side: Defense-in-depth validation before DB insert
- Character limit: max 500 characters (enforce on client + server)

### Timezone Handling

- All dates displayed in Europe/Lisbon timezone
- Use `toLocaleTimeString('pt-PT', { timeZone: 'Europe/Lisbon', ... })`
- Use `toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon', ... })`
- Never use `date-fns` format without timezone context (it uses UTC)

### Components & Styling

- Reuse `<CalmConfirmation>` from Story 1.8 for success messages
- Reuse `<EmptyState>` for error cases
- Use design system colors/tokens from Story 1.8
- Button styling: primary variant for "Declarar ausência"

---

## Architecture Compliance

### Multi-Tenant Isolation

- ✅ Player can only access their own attendance records
- ✅ Player can only see sessions for their own club
- ✅ RLS policies enforce club_id isolation on sessions table

### Server Components & Actions

- ✅ Page is Server Component (default in App Router)
- ✅ All server actions are in dedicated file `lib/actions/player-attendance.ts`
- ✅ No "use client" in page.tsx (client component is optional AbsenceDeclarationForm)

### Accessibility

- ✅ Form has visible labels
- ✅ Textarea has aria-describedby for character counter
- ✅ Buttons are descriptive (not "Submit")
- ✅ All interactive elements keyboard-accessible

### Audit Logging

- ✅ All attendance changes logged to `audit_logs` table
- ✅ Actions: `attendance.declared_absence`, `attendance.cancelled_absence`, `attendance.unauthorized_attempt`
- ✅ FR21a context captured in logs

---

## File Structure & Implementation

### NEW Files

- `sparta/src/app/(player)/agenda/[sessionId]/page.tsx` — Server component
- `sparta/src/lib/actions/player-attendance.ts` — Three server actions
- `sparta/src/components/domain/AbsenceDeclarationForm.tsx` — Client component (optional, can be inline in page.tsx)

### UPDATE Files

- `sparta/src/middleware.ts` — Verify `(player)` routes are protected

### NO Changes Required

- Sessions table schema
- Attendances table schema
- RLS policies (already support player access)

---

## Testing Requirements

### Unit Tests

```typescript
describe("getPlayerAttendanceForSession", () => {
  it("returns default status if no record exists", async () => {
    // Setup: no attendance record for (player, session)
    // Act: call getPlayerAttendanceForSession(sessionId)
    // Assert: returns { status: 'sem_questionario', note: null }
  });

  it("returns current status if record exists", async () => {
    // Setup: create attendance record with status='absent', note='doença'
    // Act: call getPlayerAttendanceForSession(sessionId)
    // Assert: returns { status: 'absent', note: 'doença' }
  });
});

describe("declarePlayerAbsence", () => {
  it("creates/updates absence record", async () => {
    // Setup: authenticate as player
    // Act: call declarePlayerAbsence(sessionId, 'lesão')
    // Assert: DB record has status='absent', note='lesão'
  });

  it("rejects note > 500 chars", async () => {
    // Setup: note with 501 characters
    // Act: call declarePlayerAbsence(sessionId, longNote)
    // Assert: returns error "Máximo 500 caracteres"
  });

  it("blocks unauthorized player access", async () => {
    // Setup: player A tries to modify player B's record
    // Act: call as player A for player B's session
    // Assert: RLS blocks, returns "Sem permissão"
  });
});

describe("cancelPlayerAbsence", () => {
  it("resets status to sem_questionario", async () => {
    // Setup: existing absent record
    // Act: call cancelPlayerAbsence(sessionId)
    // Assert: status='sem_questionario', note=null
  });
});
```

### Integration Tests

```typescript
describe("Player Session Detail Page", () => {
  it("renders session details", async () => {
    // Setup: authenticate as player, create session
    // Act: GET /agenda/[sessionId]
    // Assert: page contains session type, date/time, location, duration
  });

  it("displays declare absence form", async () => {
    // Assert: button "Declarar ausência" visible
    // Assert: textarea for note visible
    // Assert: character counter visible
  });

  it("submits absence declaration", async () => {
    // Act: fill textarea, click button
    // Assert: CalmConfirmation shows "Ausência registada"
    // Assert: button text changes to "Cancelar ausência"
  });

  it("cancels absence declaration", async () => {
    // Setup: existing absent record
    // Act: click "Cancelar ausência"
    // Assert: CalmConfirmation shows "Ausência cancelada"
    // Assert: button text reverts to "Declarar ausência"
  });

  it("redirects staff away", async () => {
    // Setup: authenticate as coach
    // Act: GET /agenda/[sessionId]
    // Assert: redirects to / (middleware enforces)
  });

  it("redirects unauthenticated to login", async () => {
    // Act: GET /agenda/[sessionId] without auth
    // Assert: redirects to /login
  });
});
```

### Accessibility (axe-core)

```typescript
describe("Accessibility", () => {
  it("passes axe checks", async () => {
    // Render page
    // Run axe(document)
    // Assert: violations.length === 0
  });
});
```

### Manual Testing Checklist

- [ ] Player navigates to `/calendario`
- [ ] Player taps a session block
- [ ] Route changes to `/agenda/[sessionId]`
- [ ] Session details display (type, date, time, location, duration)
- [ ] Button "Declarar ausência" is visible
- [ ] Textarea is visible with placeholder
- [ ] Character counter displays: "0/500"
- [ ] Player types note (< 500 chars)
- [ ] Character counter updates: "X/500"
- [ ] Player clicks "Declarar ausência"
- [ ] Confirmation shows: "Ausência registada"
- [ ] Button changes to "Cancelar ausência"
- [ ] Player clicks "Cancelar ausência"
- [ ] Confirmation shows: "Ausência cancelada"
- [ ] Button reverts to "Declarar ausência"
- [ ] Player types note (> 500 chars)
- [ ] Error message appears: "Máximo 500 caracteres"
- [ ] Button is disabled
- [ ] Staff member navigates to `/agenda/[sessionId]`
- [ ] Redirected to `/` (middleware enforcement)
- [ ] Session detail page is keyboard-accessible
- [ ] Tab order is logical
- [ ] Screen reader announces button labels correctly

---

## Dependency Tree & Story Order

### Must be DONE before this story

1. ✅ **Story 2.6** (Session data structure) — DONE
2. ✅ **Story 1.8** (Design system, CalmConfirmation) — DONE
3. ✅ **Story 1.5** (Authentication) — DONE
4. ⏳ **Story 2.12** (Player calendar view) — Backlog (creates link to this story)

### Enables (depends on this story)

- **Story 5.11** (Absence indicator in readiness panel) — Uses attendance.status='absent' to show "Vai Faltar" badge
- **Story 6.7** (Attendance recording for training sessions) — Staff attendance UI; this is player self-declaration

---

## Implementation Notes

### Key Design Decision: Client vs. Server Validation

**Why both?**
- Client-side validation provides immediate feedback (UX)
- Server-side validation prevents malicious requests (security)
- Defense-in-depth: always validate on both sides

**Example:**
```typescript
// Client: Zod validation
if (note.length > 500) {
  setError("Máximo 500 caracteres");
  return;
}

// Server: Zod validation again
const schema = z.object({ note: z.string().max(500) });
const parsed = schema.safeParse({ note });
if (!parsed.success) {
  return { ok: false, error: { message: "Máximo 500 caracteres" } };
}
```

### State Transitions

```
Initial State: status='sem_questionario', note=null
↓
User clicks "Declarar ausência" + enters note
↓
Server updates: status='absent', note='...'
↓
UI shows CalmConfirmation, button changes to "Cancelar ausência"
↓
User clicks "Cancelar ausência"
↓
Server updates: status='sem_questionario', note=null
↓
Back to Initial State
```

### Preventing Race Conditions

Use `updated_at` timestamp to detect conflicts:
- If concurrent edits occur, the second request's `updated_at` will be newer
- Optional: add optimistic locking with version field (OUT OF SCOPE for MVP)

---

## Learnings from Story 2.12 (Calendar)

From story 2.12 (read-only calendar):
- Player routes are separate from staff routes via `(player)` and `(staff)` route groups
- Middleware enforces role-based access
- Session navigation from calendar should go to `/agenda/[sessionId]` (this story)
- Reuse design system components (CalmConfirmation, EmptyState, Button)

---

## Status & Handoff

**Ready for development.** All context captured:
- ✅ Attendance table schema exists
- ✅ RLS policies support player isolation
- ✅ Server action patterns established (from prior stories)
- ✅ Acceptance criteria are testable
- ✅ No dependencies on unfinished stories (except 2.12 which is simple)

**Next:** Dev agent runs `/dev-story 2-13` to implement.
**After:** `/code-review` for quality gate.

---

## References & Artifacts

- **Attendance Table:** Story 2.6 or migration `000090_attendances.sql`
- **Design System:** [Story 1.8 - Design System Foundation](1-8-design-system-foundation-tokens-7-pattern-components-button-hierarchy.md)
- **Calendar:** [Story 2.12 - Player Calendar](2-12-player-calendar-read-only-view-jogador.md)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` (Multi-Tenant, RLS, Timezone)

---

**Completed:** Ultimate context engine analysis — comprehensive developer guide created ✅
