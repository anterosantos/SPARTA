---
story_id: "5.11"
story_key: "5-11-absence-indicator-in-readiness-panel-vai-faltar-badge"
epic: "Epic 5 — Painel de Prontidão & Inteligência"
status: "ready-for-dev"
created: 2026-06-05
depends_on:
  - "5-4-painel-de-prontidao-lista-por-posicao-default-view (done)"
  - "2-13-player-session-detail-page-absence-declaration"
related_stories:
  - "5-4-painel-de-prontidao-lista-por-posicao-default-view"
  - "2-13-player-session-detail-page-absence-declaration"
---

# Story 5.11: Absence Indicator in Readiness Panel ("Vai Faltar" Badge)

**Status:** ready-for-dev | **Story ID:** 5.11 | **Epic:** Epic 5

**Depends on:**
- Story 5.4 (Readiness Panel — done)
- Story 2.13 (Player absence declaration — backlog)

---

## Story

**As a** Treinador,
**I want to** see when a player has declared their absence directly on their card in the readiness panel,
**So that** I can account for self-declared absences when preparing the squad without opening each player's drill-down.

---

## Acceptance Criteria

### AC #1: Absence Badge Display on PlayerRow

**Given** a player has `status='absent'` in the `attendances` table for the upcoming session
**When** the Painel de Prontidão renders (`/prontidao`)
**Then** the player's `<PlayerRow>` card shows an orange "Vai faltar" badge
**And** the badge uses `signal/caution` color (from design tokens) with `UserX` lucide icon
**And** the badge is positioned directly below the player's name
**And** the session date/time is shown in PT-PT short format (e.g., "qua 5 jun · 19:30") next to or below the badge
**And** the icon provides sensory redundancy (not relying on color alone for meaning)

### AC #2: Absence Note Display & Truncation

**Given** the player provided a justification note when declaring absence (Story 2.13)
**When** the player row renders
**Then** the note is shown in italic gray text below the badge and date label
**And** the note is truncated to 80 characters with "…" if longer (e.g., "lesão no joelho..." instead of full 150-char text)
**And** the full note is accessible via `aria-label` or tooltip on hover (optional; truncation alone is acceptable)

### AC #3: Data Source — Extended PlayerReadinessData Type

**Given** the `getReadinessPanelData` server action is invoked
**When** it fetches data for the upcoming session
**Then** the returned `PlayerReadinessData` type includes two new fields:
  - `declaredAbsent: boolean` — true if `attendances.status='absent'` for this player + session
  - `absenceNote: string | null` — the note from `attendances.note` (truncated at 80 chars in query or component)
**And** the query joins `attendances` table: `LEFT JOIN attendances ON (attendances.session_id = $1 AND attendances.player_id = players.id)`
**And** the join filters only for `status='absent'` (or fetches all and filters in TypeScript)

### AC #4: Conditional Rendering

**Given** a player with `status != 'absent'` or no attendance record
**When** the player row renders
**Then** no "Vai faltar" badge is shown
**And** no absence note is displayed
**And** the card layout remains unchanged (no empty space reserved for the missing badge)

### AC #5: Accessibility

**Given** the badge renders on the player row
**When** testing with axe-core
**Then** the badge has semantic HTML:
  - `role="status"` or `role="img"` as appropriate
  - `aria-label="Jogador declarou ausência"` for screen readers
  - Color not the sole indicator of absence (icon + text ensures redundancy)
**And** the note text is readable by screen readers
**And** zero axe violations reported

### AC #6: Mobile Responsiveness

**Given** the readiness panel displays on mobile (< 768px)
**When** the badge and note render
**Then** the layout does not break or overflow
**And** the badge, date, and note stack vertically if needed
**And** tap targets remain ≥ 44×44px (accessible touch size)

---

## Developer Context

### Current Implementation (Story 5.4)

The readiness panel already exists with `<PlayerRow>` components displaying player name, readiness state semaphore, ACWR band, and more. This story adds the absence badge to that card.

**Components involved:**
- `src/components/domain/ReadinessPanel.tsx` — Main panel container
- `src/components/domain/ReadinessPanel/PositionGroup.tsx` — Organizes by position
- `src/components/domain/ReadinessPanel/PlayerRow.tsx` — Individual player card (UPDATE)

### Server Action Changes — `getReadinessPanelData`

**Current location:** `src/lib/actions/readiness.ts`

**Change required:**
1. Extend the `PlayerReadinessData` type to include `declaredAbsent: boolean` and `absenceNote: string | null`
2. Update the query to LEFT JOIN `attendances` table:
   ```sql
   LEFT JOIN attendances ON 
     attendances.session_id = readiness_snapshots.session_id
     AND attendances.player_id = readiness_snapshots.player_id
     AND attendances.status = 'absent'
   ```
3. Select the note: `SELECT ..., attendances.note as absence_note`
4. Map to TypeScript with truncation: `absenceNote: attendance?.note?.substring(0, 80) + (attendance?.note?.length > 80 ? '...' : '') ?? null`

**Example query logic:**
```typescript
const { data: readinessData } = await supabase
  .from("readiness_snapshots")
  .select(`
    player_id,
    state,
    acwr,
    ...,
    attendances!inner(note)
  `)
  .eq("session_id", sessionId)
  .eq("attendances.status", "absent")
  .eq("attendances.session_id", sessionId);

// Or: LEFT JOIN instead of !inner, then filter in TypeScript
```

### Component Changes — `PlayerRow.tsx`

**Props (no change to interface, add optional prop):**
```typescript
interface PlayerRowProps {
  playerName: string;
  state: 'green' | 'yellow' | 'red';
  acwr: number;
  declaredAbsent?: boolean;
  absenceNote?: string | null;
  // ... existing props
}
```

**Rendering logic (pseudocode):**
```tsx
<div className="player-row">
  <div className="player-header">
    <span className="name">{playerName}</span>
    {state && <SemaforoBadge state={state} />}
  </div>

  {/* NEW: Absence Badge */}
  {declaredAbsent && (
    <div className="absence-section">
      <Badge color="caution" icon={UserX} aria-label="Jogador declarou ausência">
        Vai faltar
      </Badge>
      <small className="text-muted">{sessionDate} · {sessionTime}</small>
      {absenceNote && (
        <p className="note italic text-muted">{absenceNote}</p>
      )}
    </div>
  )}

  {/* Existing: ACWR Band, Readiness Graph, etc. */}
</div>
```

### Styling

Use design system tokens:
- Badge color: `signal/caution` (orange, from Story 1.8 tokens)
- Text color for note: `text-muted` or `text-xs text-gray-600`
- Italic style: `font-italic`
- Icon: `lucide-react/UserX`
- Gap between badge and note: `gap-1`

---

## Technical Requirements

### Query Optimization

The LEFT JOIN on `attendances` can be expensive if the table is large. **Recommendation:**
- Add an index: `CREATE INDEX idx_attendances_session_player_status ON attendances(session_id, player_id, status);`
- Or: Cache/denormalize absence flags in `readiness_snapshots` if absence declarations are rare (optional optimization)

### Type Definitions

Update `src/lib/types/readiness.ts` (or wherever `PlayerReadinessData` is defined):

```typescript
export interface PlayerReadinessData {
  playerId: string;
  playerName: string;
  state: 'green' | 'yellow' | 'red';
  acwr: number;
  declaredAbsent: boolean; // NEW
  absenceNote: string | null; // NEW (max 80 chars)
  // ... existing fields
}
```

### RLS — No Changes

The existing RLS policies on `attendances` allow staff (coach/analyst) to read all records for their club. No new policies needed.

---

## Testing Requirements

### Unit Tests

```typescript
describe("Absence Indicator", () => {
  it("displays 'Vai faltar' badge when player absent", () => {
    // Setup: player with status='absent' in attendances
    // Render: <PlayerRow declaredAbsent={true} ... />
    // Assert: badge with text "Vai faltar" is visible
  });

  it("hides badge when player not absent", () => {
    // Setup: player with status='present' or no record
    // Render: <PlayerRow declaredAbsent={false} ... />
    // Assert: no badge rendered
  });

  it("truncates note to 80 characters", () => {
    // Setup: long note (150+ chars)
    // Render: <PlayerRow absenceNote={longNote} ... />
    // Assert: displayed text ends with "…"
    // Assert: truncated text <= 83 chars (80 + "…")
  });

  it("displays full absence note in aria-label", () => {
    // Assert: aria-label contains full note for screen readers
  });
});

describe("getReadinessPanelData", () => {
  it("includes absence data in response", async () => {
    // Setup: create attendance record with status='absent'
    // Act: call getReadinessPanelData(sessionId)
    // Assert: response[i].declaredAbsent === true
    // Assert: response[i].absenceNote matches DB value
  });

  it("excludes absent=true for non-absent players", async () => {
    // Setup: no absence record for player
    // Assert: declaredAbsent === false
  });
});
```

### Integration Tests

```typescript
describe("Readiness Panel with Absences", () => {
  it("renders panel with absence badges", async () => {
    // Setup: create session, attendance records
    // Act: GET /prontidao
    // Assert: page contains badge(s) with "Vai faltar" text
  });

  it("updates badge when absence is declared (manual refresh)", async () => {
    // Setup: initial render without absence
    // Act: Player declares absence via /agenda (Story 2.13)
    // Act: Staff manually refreshes panel (button click or page reload)
    // Assert: badge now appears
  });
});
```

### Accessibility (axe-core)

```typescript
it("passes axe checks", async () => {
  // Render panel with absence badges
  // Run axe(document)
  // Assert: violations.length === 0
});
```

### Manual Testing Checklist

- [ ] Readiness panel loads
- [ ] Player with absence shows "Vai faltar" badge in orange
- [ ] Badge has UserX icon (sensory redundancy)
- [ ] Session date/time displayed next to badge
- [ ] Absence note (if provided) shows in italic below badge
- [ ] Long note (> 80 chars) truncates with "…"
- [ ] Player without absence shows NO badge
- [ ] Badge is not breaking layout on mobile
- [ ] Tab order is logical (badge area is reachable via keyboard)
- [ ] Screen reader announces "Jogador declarou ausência" for badge

---

## Dependency Tree

### Must be DONE before this story

1. ✅ **Story 5.4** (Readiness Panel) — DONE
2. ⏳ **Story 2.13** (Absence declaration) — Backlog (but already scoped to return absence data)

### Enables

- Future features that reference absence status (notifications, analytics, etc.)

---

## Implementation Notes

### JOIN Strategy

**Option A (Recommended): LEFT JOIN with filter in TypeScript**
- Query all players, left-join absences, filter by `status='absent'` in app
- Simpler SQL, clearer intent
- Slightly more data transfer (but negligible for typical squad size)

**Option B: Subquery**
- Use a subquery to fetch only absent players
- More efficient SQL but harder to read

**Recommendation:** Option A for clarity and maintainability.

### Absence Note Truncation

Truncate in component (not query) for consistency:
```typescript
const truncated = absenceNote && absenceNote.length > 80
  ? absenceNote.substring(0, 80) + '…'
  : absenceNote;
```

---

## Status & Handoff

**Ready for development.** All context captured:
- ✅ Readiness panel structure exists
- ✅ Attendance table has absence data
- ✅ Design tokens available (signal/caution)
- ✅ Acceptance criteria testable
- ✅ Dependencies well-scoped

**Next:** Dev agent runs `/dev-story 5-11` to implement.

---

**Completed:** Ultimate context engine analysis — comprehensive developer guide created ✅
