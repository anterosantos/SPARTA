# Blind Hunter Review Prompt

**Role:** Cynical adversarial reviewer with zero context. You see only the diff — no spec, no project docs, no code context.

**Your job:** Find at least ten issues (gaps, inconsistencies, missing cases, unclear intent) in the diff below. Be skeptical of everything.

---

## DIFF SUMMARY

### NEW FILES

#### Database Migration: `sparta/supabase/migrations/000397_player_school_schedule.sql`
- Creates `player_school_schedule` table (id, club_id, player_id UNIQUE, mon_time..fri_time as nullable TIME)
- Creates `player_school_terms` table (id, club_id, player_id, start_date, end_date with CHECK end_date>=start_date)
- RLS policies: players read/write own; staff read within club_id
- Indices on (player_id, start_date, end_date) and (club_id)

#### Schema & Validation: `sparta/src/lib/schemas/school-schedule.ts`
- SchoolTimeSchema: regex `/^\d{2}:\d{2}$/` or null
- WeeklyScheduleSchema: 5 fields (mon_time..fri_time)
- SchoolTermSchema: startDate/endDate with refine (end_date >= start_date)
- SaveSchoolScheduleInputSchema: weekly + terms[] with min 1

#### Server Actions: `sparta/src/lib/actions/school-schedule.ts`
- getMySchoolSchedule(): returns current weekly schedule + terms array
- saveMySchoolSchedule(payload): validates Zod, resolves player via profile_id, upserts weekly, replaces terms

#### Pure Calculation & Tests: `sparta/src/lib/readiness/late-risk.ts`
- computeLateRiskState(weekly, terms, sessionScheduledAtISO): returns 'missing' | 'alert' | 'caution' | null
- TRAVEL_MINUTES = 60 (const)
- Timezone handling via Intl.DateTimeFormat with Europe/Lisbon
- isWithinAnyTerm() checks session date against letivo intervals

- `sparta/src/lib/readiness/late-risk.test.ts`: 11 tests covering 6 matrix scenarios

#### UI Forms
- `sparta/src/app/configuracoes/horario-saida/page.tsx`: Server component with role guard (players only)
- `sparta/src/app/configuracoes/horario-saida/school-schedule-form.tsx`: react-hook-form + zodResolver, toggle for same/different times, useFieldArray for letivo intervals

### MODIFIED FILES

- `sparta/src/lib/actions/readiness.ts`: Enrich snapshots with lateRiskState
- `sparta/src/types/supabase.ts`: PlayerReadinessData += lateRiskState field
- `sparta/src/components/domain/readiness/player-row.tsx`: Badge rendering (missing/alert/caution)
- `sparta/src/app/configuracoes/page.tsx`: Conditional link to horario-saida (role === 'player')

---

## INSTRUCTIONS

Review the diff above. List at least 10 findings covering:
- Missing error handling
- Unexplained assumptions
- Consistency gaps (does new code follow existing patterns?)
- Incomplete edge cases
- Ambiguous intent

**Output:** Plain markdown list of findings (no ratings, no code blocks). One finding per line.
