# Acceptance Auditor Review Prompt

**Role:** Acceptance auditor. You have the spec, the diff, and full project read access. Your job: verify that the implementation matches the spec intent and acceptance criteria.

---

## SPEC REFERENCE

**File:** `c:\Users\anter\OneDrive\Documents\GitHub\SPARTA\_bmad-output\implementation-artifacts\spec-horario-saida-risco-atraso.md`

**Key intent:**
- Players register weekly school exit times (Mon–Fri) once per season, editable later
- Coaches see late-arrival risk alerts in Prontidão based on: exit_time + 60min fixed travel vs session start time
- No geolocation, no configurable tolerance, just exact comparison
- RLS: players read/write own; staff read-only within club
- Timezone: always Europe/Lisbon

**Acceptance Criteria:**
1. Player without schedule → 'missing' chip in Prontidão
2. Player with schedule inside letivo interval, arrival after start → red 'alert' badge
3. Session outside any letivo interval → no badge
4. Invalid date range (endDate < startDate) → form rejected, nothing saved
5. Player returns to form → sees pre-filled values, can edit

---

## DIFF SUMMARY

**New files:**
- Migration `000397_player_school_schedule.sql` (2 tables, RLS, indices)
- Schema `school-schedule.ts` (Zod validation)
- Server action `school-schedule.ts` (get/save)
- Pure function `late-risk.ts` (computation) + tests
- UI forms `horario-saida/` (page + form component)

**Modified files:**
- `readiness.ts` (integration into snapshot enrichment)
- `types/supabase.ts` (lateRiskState field)
- `player-row.tsx` (badge rendering)
- `configuracoes/page.tsx` (conditional link)

---

## AUDIT CHECKLIST

### Specification Compliance
- [ ] Does the schema enforce the regex `/^\d{2}:\d{2}$/` for time format?
- [ ] Does SaveSchoolScheduleInputSchema require `terms[]` with min 1?
- [ ] Does the computation use exactly `TRAVEL_MINUTES = 60`?
- [ ] Does timezone handling use `Europe/Lisbon` explicitly?
- [ ] Are the three states correctly mapped: 'missing' (no schedule), 'alert' (arrival > start), 'caution' (arrival == start)?

### RLS & Security
- [ ] Does `player_school_schedule` have UNIQUE on `player_id`?
- [ ] Do RLS policies use `EXISTS (SELECT FROM profiles...)` pattern (not `auth.club_id()`)?
- [ ] Can a player see/write only their own schedule?
- [ ] Can staff see schedules only within their club_id?
- [ ] Are explicit club_id filters present in all service-role queries?

### Data Integrity
- [ ] Does the migration include `CHECK end_date >= start_date`?
- [ ] Does saveMySchoolSchedule validate against Zod before writing?
- [ ] Does getMySchoolSchedule return defaults if no schedule exists (avoid null issues)?
- [ ] Is the form pre-fill logic safe (handles missing terms gracefully)?

### Integration
- [ ] Is lateRiskState correctly merged into PlayerReadinessData?
- [ ] Does computeLateRiskState receive all three parameters (weekly, terms, sessionScheduledAt)?
- [ ] Are scheduleMap and termsMap built correctly from service-role queries?
- [ ] Is the badge only shown when lateRiskState is not null and not 'missing'?

### UI/UX
- [ ] Is the "Horário de Saída" link visible only for `role === 'player'`?
- [ ] Does the form toggle between "same time" and "different times"?
- [ ] Can the user add/remove letivo intervals dynamically?
- [ ] Does form submission show success/error feedback?
- [ ] Is the role guard in place (non-players redirected)?

### Tests
- [ ] Do the 11 tests cover the 6 matrix scenarios (missing, alert, caution, null, invalid dates)?
- [ ] Are timezone edge cases tested (DST boundaries, midnight)?
- [ ] Are invalid date ranges caught?

---

## INSTRUCTIONS

1. **Access:** You have full read access to the SPARTA project
2. **Verify:** Check each point above against the actual code
3. **Report findings** that indicate:
   - **intent_gap** — spec intent incomplete/unclear, cannot resolve from code alone
   - **bad_spec** — implementation deviates from spec; spec should have prevented it
   - **patch** — trivial bug (typo, logic error, etc.)
   - **defer** — pre-existing issue, not caused by this change
   - **reject** — noise, drop silently

4. **Output format:**
   ```markdown
   ## Findings

   ### bad_spec
   - [AC-1] Badge styling: spec says "signal-alert/signal-caution" but code uses... [reason]

   ### patch
   - [Schema] Time regex accepts "25:99" — should be `/(0\d|1\d|2[0-3]):(0\d|[1-5]\d)$/`

   ### defer
   - [RLS] Other tables in app use `auth.club_id()` (pattern inconsistency pre-existing)

   ### reject
   - [Comment] "TODO: add logging" — generic noise
   ```

Provide a clear categorized list of findings (empty section if no findings in that category).
