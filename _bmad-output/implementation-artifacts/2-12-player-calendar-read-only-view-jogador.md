---
story_id: "2.12"
story_key: "2-12-player-calendar-read-only-view-jogador"
epic: "Epic 2 — Plantel, Calendário & Sessões"
status: "ready-for-dev"
created: 2026-06-05
depends_on:
  - "2-11-calendar-visual-alignment-session-colors-week-month-toggle-proximos-7-dias (done)"
  - "2-7-calendar-view-per-role (done)"
  - "1-5-email-password-authentication-password-recovery (done)"
related_stories:
  - "2-13-player-session-detail-page-absence-declaration"
---

# Story 2.12: Player Calendar — Read-Only View (Jogador)

**Status:** ready-for-dev

**Story ID:** 2.12

**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)

**Depends on:** 
- Story 2.11 (calendar visual design — done)
- Story 2.7 (calendar data structure — done)
- Story 1.5 (authentication — done)

**UX Reference:** Same visual components from Story 2.11, but read-only for player role

---

## Story

**As a** Jogador,
**I want to** view the club's session calendar in read-only mode with week and month views,
**So that** I can see upcoming training sessions and matches without needing to contact staff.

---

## Acceptance Criteria

### AC #1: Player Calendar Route & Role Enforcement

**Given** a Jogador is authenticated
**When** they navigate to `/calendario`
**Then** the route is permitted (middleware allows player access)
**And** the page renders the read-only calendar layout
**And** the URL `/calendario` is accessible via the bottom tab bar ("Hoje · Calendário · Histórico · Eu")

**Given** a staff member (coach/analyst) navigates to `/calendario`
**When** the page loads
**Then** they see the STAFF calendar (`(staff)/calendario/page.tsx`) with create/edit/cancel controls
**And** players see the PLAYER calendar (`(player)/calendario/page.tsx`) without controls
**And** the middleware enforces this role-based routing (no redirect loop)

### AC #2: Read-Only Layout — No Create/Edit/Cancel Controls

**Given** the player calendar page renders
**When** the visual layer initializes
**Then** the "Create Session" button (+ icon) is NOT rendered
**And** the session blocks show NO edit/delete icons
**And** the session blocks show NO "Cancelar" button
**And** the page layout is otherwise identical to the staff view (Story 2.11)

### AC #3: Attendance Count Badge Hidden

**Given** the session blocks render in week view
**When** each session displays
**Then** the attendance count badge (e.g., "14/20 presentes") is NOT visible to the player
**And** the badge is visible only to staff in the staff calendar view
**And** all other visual elements (colors, icons, time, duration, location) are identical

### AC #4: Same Visual Components as Story 2.11

**Given** the player and staff calendars are both active
**When** comparing their visual rendering
**Then** both use the same components:
  - `<CalendarViewToggle/>` (week/month toggle, identical styling)
  - `<CalendarWeekView/>` (colored blocks, dots, navigation)
  - `<CalendarMonthView/>` (grid, dots, cell selection)
  - `<SeasonToggle/>` (cumulative vs. season filter)
  - `<StickyHeader/>` (header with toggle + nav buttons)
**And** the only difference is the presence/absence of control buttons

### AC #5: Session Selection Still Works

**Given** the player calendar is in week or month view
**When** the player taps/clicks on a session block
**Then** the route navigates to `/agenda/[sessionId]` (Story 2.13)
**And** the session detail page opens with their attendance status and absence declaration form
**And** this tap/click behavior is identical to the staff view

### AC #6: "Próximos 7 Dias" Section Identical to Staff View

**Given** the week view is active
**When** the "PRÓXIMOS 7 DIAS" section renders below the week grid
**Then** the layout, colors, dates, and interactivity are identical to the staff view
**And** the attendance count badge is hidden (same as AC #3)
**And** tapping an item navigates to `/agenda/[sessionId]`

### AC #7: RLS Enforcement — Player Can Only See Their Club Sessions

**Given** a player makes a request to `getSessionsForClub()`
**When** the server action executes
**Then** the existing RLS policies on the `sessions` table allow read-only access scoped to `club_id`
**And** no new migrations are required (reuse existing policies)
**And** the player sees only sessions for their own club (multi-tenant isolation)

### AC #8: Empty State

**Given** the player navigates to the calendar
**When** no sessions exist in the visible range (week/month)
**Then** an `<EmptyState>` component displays
**And** the copy shows "Sem sessões agendadas neste período"
**And** the empty state layout matches the staff view

### AC #9: Accessibility

**Given** the player calendar renders
**When** testing with axe-core
**Then** all session blocks have semantic structure:
  - `role="article"` with `aria-label` describing session type, time, and location
  - Week/month toggle uses `role="tablist"` with `role="tab"` on each option
  - `aria-selected` attribute on the active tab
  - Navigation arrows have descriptive `aria-label` ("Semana anterior", "Próxima semana", etc.)
**And** zero violations reported by axe

### AC #10: Persistent View Mode (Week vs. Month)

**Given** the player toggles between week and month views
**When** they navigate away and return to `/calendario`
**Then** the previously selected view persists
**And** persistence uses URL query param `?vista=semana` or `?vista=mes` (same as staff view)
**And** the state survives page reload and is shareable via link

---

## Developer Context

### Current Implementation (Story 2.11 — done)

**Location:** `sparta/src/app/(staff)/calendario/page.tsx`

The staff calendar page exists and provides:
- Server component fetching sessions via `getSessionsForClub()`
- `CalendarViewToggle` component for week/month selection
- `CalendarWeekView` rendering colored blocks by session type
- `CalendarMonthView` rendering month grid with dots
- `SeasonToggle` for cumulative vs. season-filtered data
- Session blocks with create/edit/cancel buttons

**Key components involved:**
- `src/components/ui/calendar-view-toggle.tsx` — toggle logic + styling
- `src/components/ui/calendar-week-view.tsx` — week rendering
- `src/components/ui/calendar-month-view.tsx` — month rendering
- `src/lib/actions/sessions.ts` — `getSessionsForClub()` server action

### Route Structure Decision

**Problem:** How to serve both staff AND player calendars without code duplication?

**Solution:** Create a new `(player)/calendario/page.tsx` that:
1. Reuses the exact same visual components from `(staff)/calendario/page.tsx`
2. Differs ONLY in:
   - Role check: `if (profile.role !== 'player') redirect('/')`
   - Conditional rendering of control buttons (create, edit, delete)
   - Hidden attendance count badges

**This approach:**
- ✅ Maintains single source of truth for visual design (story 2.11 components)
- ✅ Keeps player/staff routes cleanly separated via route groups
- ✅ Allows middleware to enforce role-based access
- ✅ Avoids component prop bloat (no `readOnly` flags everywhere)

### Middleware Integration

The existing middleware (`src/middleware.ts`) already enforces role-based routing:
- Routes under `(staff)/` redirect non-staff (coach/analyst) to `/`
- Routes under `(player)/` should redirect non-players to `/`

**Verify:** Middleware currently checks `profile.role` and redirects. Ensure `(player)` routes are covered.

### Server Actions — `getSessionsForClub()`

**Location:** `src/lib/actions/sessions.ts`

This server action already exists and returns `Result<Session[], ErrorPayload>`.

**Pattern in staff calendar:**
```typescript
const result = await getSessionsForClub();
if (!result.ok) throw new Error(...);
const sessions = result.data.slice().sort(...);
```

**For player calendar:** Reuse the exact same action. The RLS policy on `sessions` table already allows players to read their club's sessions.

### Component Extraction for Shared Logic

To avoid duplicating the entire page, extract shared logic:

**Option A (Recommended):** Extract a `<SharedCalendarContent>` component that accepts a `readOnly: boolean` prop.

```typescript
// src/components/domain/shared-calendar-content.tsx
export async function SharedCalendarContent({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  // Fetch data
  const result = await getSessionsForClub();
  if (!result.ok) throw new Error(...);
  const sessions = result.data;

  return (
    <StickyHeader>
      {/* Conditional: hide create button if readOnly */}
      {!readOnly && <Button><Plus/> Nova Sessão</Button>}
      
      <CalendarViewToggle />
      {/* ... rest of content ... */}
    </StickyHeader>
  );
}
```

Then in both staff and player pages:
```typescript
// (staff)/calendario/page.tsx
export default async function StaffCalendarioPage() {
  return <SharedCalendarContent readOnly={false} />;
}

// (player)/calendario/page.tsx
export default async function PlayerCalendarioPage() {
  return <SharedCalendarContent readOnly={true} />;
}
```

**Option B:** Keep pages separate but reuse components. Both pages call the same server action and render the same components, with conditional logic for buttons.

**Recommendation:** Option A is cleaner. Implement if component doesn't grow beyond ~200 LOC.

---

## Technical Requirements

### Route Structure

- **Route:** `(player)/calendario/page.tsx` (NEW)
- **Layout:** Inherits from `(player)/layout.tsx` (must exist from story 1.9)
- **Metadata:** `{ title: "Calendário" }`

### Server Component Checks

**In `(player)/calendario/page.tsx`:**

1. Fetch authenticated user:
   ```typescript
   const supabase = await createServerClient();
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) redirect("/login");
   ```

2. Fetch user's role from profiles:
   ```typescript
   const { data: profile } = await supabase
     .from("profiles")
     .select("role")
     .eq("id", user.id)
     .single();
   
   if (!profile || profile.role !== "player") {
     redirect("/");
   }
   ```

3. Fetch sessions:
   ```typescript
   const result = await getSessionsForClub();
   if (!result.ok) throw new Error(...);
   ```

### Component Props — Read-Only Flag

If using Option A (shared component), pass `readOnly={true}` to suppress:
- Create button
- Edit/delete icons on session blocks
- Attendance count badge

If keeping pages separate, implement conditional rendering directly in the player page.

### Import Consistency

Reuse all imports from the staff calendar:
- `CalendarViewToggle`, `CalendarWeekView`, `CalendarMonthView` from `@/components/ui`
- `SeasonToggle`, `StickyHeader` from `@/components/patterns`
- `getSessionsForClub`, `getCurrentSeason` from `@/lib/actions`
- `date-fns` for date manipulation

---

## Architecture Compliance

### Multi-Tenant Isolation

- ✅ RLS policies on `sessions` table already enforce `club_id` isolation
- ✅ Player can only read sessions for their own club
- ✅ No changes to existing RLS policies required

### Route Group Convention

- ✅ Player-specific routes live under `(player)/`
- ✅ Staff-specific routes live under `(staff)/`
- ✅ Middleware enforces role-based access (verify in `src/middleware.ts`)

### Server Components & Actions

- ✅ Page is a Server Component (default in App Router)
- ✅ Reuses existing `getSessionsForClub()` server action
- ✅ No new server actions required

### Accessibility

- ✅ Reuses components from Story 2.11 (already tested with axe-core)
- ✅ All interactive elements have ARIA labels
- ✅ Tab navigation with `role="tablist"`

---

## File Structure & Implementation

### NEW Files

- `sparta/src/app/(player)/calendario/page.tsx` — Player calendar page

### MODIFIED Files

If using shared component approach:
- `sparta/src/components/domain/calendar-content.tsx` — Extract common logic (NEW)

Potentially:
- `sparta/src/middleware.ts` — Verify `(player)` routes are protected (if not already)

### UPDATE Expected

- `sparta/src/lib/actions/sessions.ts` — No changes; reuse existing action
- Calendar components (`calendar-view-toggle.tsx`, etc.) — No changes; reuse as-is

---

## Testing Requirements

### Unit Tests

- ✅ Reuse tests from Story 2.11 (calendar components already tested)
- Test role-based access control in player page (Jogador role allows access, staff redirects)

### Integration Tests

```typescript
describe("Player Calendar", () => {
  it("renders calendar for authenticated player", async () => {
    // Setup: mock authenticated player
    // Act: GET /calendario as player
    // Assert: response status 200, calendar content visible
  });

  it("hides create button for player", async () => {
    // Assert: query('button[aria-label*="Nova Sessão"]') → null
  });

  it("hides attendance count badge", async () => {
    // Assert: query('text[content="14/20 presentes"]') → null
  });

  it("redirects non-player to home", async () => {
    // Setup: mock authenticated staff (coach)
    // Act: GET /calendario as coach
    // Assert: redirects to / (middleware enforces)
  });

  it("redirects unauthenticated users to login", async () => {
    // Act: GET /calendario without auth
    // Assert: redirects to /login
  });

  it("allows tap-to-session navigation", async () => {
    // Act: tap session block
    // Assert: navigates to /agenda/[sessionId]
  });

  it("session blocks are identical to staff view visually", async () => {
    // Compare rendering between (player) and (staff) calendars
    // Assert: colors, icons, spacing are identical
  });
});
```

### Accessibility (axe-core)

```typescript
describe("Accessibility", () => {
  it("passes axe checks with zero violations", async () => {
    // Render player calendar
    // Run axe(document)
    // Assert: violations.length === 0
  });
});
```

### Manual Testing Checklist

- [ ] Player logs in → navigates to `/calendario` → calendar loads
- [ ] Calendar shows sessions for player's club only
- [ ] Week view: dots appear under correct days
- [ ] Month view: grid renders with colored dots
- [ ] Toggle persists between week/month via URL query param
- [ ] Tapping session → navigates to `/agenda/[sessionId]`
- [ ] Create button is NOT visible
- [ ] Session blocks have NO edit/delete icons
- [ ] Attendance count badge is hidden
- [ ] Empty state shows when no sessions in range
- [ ] Accessibility: Tab navigation works, ARIA labels present

---

## Dependency Tree & Story Order

### Must be DONE before this story

1. ✅ **Story 2.11** (Calendar visual components) — DONE
2. ✅ **Story 2.7** (Calendar data & server actions) — DONE
3. ✅ **Story 1.5** (Authentication) — DONE
4. ✅ **Story 1.9** (Role-based routing & navigation) — DONE

### Enables (depends on this story)

- **Story 2.13** (Player Session Detail & Absence Declaration) — Will use `/agenda/[sessionId]` route that opens from calendar taps

---

## Implementation Notes

### Reuse Strategy

The key to this story's simplicity is **maximum component reuse** from Story 2.11:
- Do NOT rewrite `CalendarViewToggle`, `CalendarWeekView`, `CalendarMonthView`
- Do NOT duplicate styling or layout logic
- Do NOT add new migrations

Instead:
1. Copy the structure of `(staff)/calendario/page.tsx`
2. Add role check: `if (profile.role !== "player") redirect("/")`
3. Pass `readOnly={true}` flag to components (or use conditional rendering)
4. Components handle the flag internally (hide buttons, etc.)

### Avoided Complexity

This story is intentionally scoped to be **simple and focused**:
- ❌ NO new components (reuse from 2.11)
- ❌ NO new server actions (reuse `getSessionsForClub`)
- ❌ NO schema changes (reuse existing tables)
- ❌ NO migrations (existing RLS already covers player read access)
- ❌ NO new styling (visual components unchanged)

### Git & Commit Pattern

After implementation:
```bash
git add sparta/src/app/\(player\)/calendario/page.tsx
# or if shared component:
git add sparta/src/components/domain/calendar-content.tsx
git add sparta/src/app/\(player\)/calendario/page.tsx
git commit -m "feat(calendario): jogador read-only calendar view"
```

---

## Context & Learnings from Story 2.11

From the completed story 2.11:
- Calendar components are mature and well-tested
- Session colors are fixed: training=#2563EB, match=#DC2626, friendly=#CA8A04
- "Próximos 7 Dias" section displays correctly
- Month view grid works with up to 3 dots + "+N" for overflow
- Toggle persists via `?vista=semana` or `?vista=mes` URL param

**Learnings to apply:**
- Session blocks need full-width styling for visual clarity
- Tap targets must be ≥60×60px (already done in Story 2.11)
- Empty state copy should be generic: "Sem sessões agendadas neste período"
- Attendance count must be removed (privacy; staff-only information)

---

## Middleware & Role-Based Routing

**Verify in `src/middleware.ts`:**

```typescript
// Existing pattern for (staff) routes:
const staffRoutes = ["/calendario", "/prontidao", "/tendencias", "/plantel"];
if (staffRoutes.includes(pathname) && profile.role !== "coach" && profile.role !== "analyst") {
  return NextResponse.redirect(new URL("/", request.url));
}

// Similar pattern should apply to (player) routes:
const playerRoutes = ["/hoje", "/questionario", "/calendario", "/agenda", "/historico"];
if (playerRoutes.includes(pathname) && profile.role !== "player") {
  return NextResponse.redirect(new URL("/", request.url));
}
```

If middleware doesn't exist or is incomplete, it must be fixed to enforce role-based access before this story is implemented.

---

## Status & Handoff

**Ready for development.** All context is captured:
- ✅ Visual components exist and are tested
- ✅ Server actions exist and reusable
- ✅ RLS policies support player read access
- ✅ Route structure is clear (player vs. staff)
- ✅ Acceptance criteria are testable
- ✅ No dependencies on unfinished stories

**Next:** Dev agent runs `/dev-story 2-12` to implement.
**After:** `/code-review` for quality gate.

---

## References & Artifacts

- **UX Design:** `docs/ux-design/Variação A Semana (timeline + agenda).png` + `Variação B Mês (grid heatmap + agenda).png`
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` (Route Groups, Multi-Tenant Isolation)
- **Related Story:** [2.11 - Calendar Visual Alignment](2-11-calendar-visual-alignment-session-colors-week-month-toggle-proximos-7-dias.md)
- **Next Story:** [2.13 - Player Session Detail & Absence Declaration](2-13-player-session-detail-page-absence-declaration.md)

---

**Completed:** Ultimate context engine analysis — comprehensive developer guide created ✅
