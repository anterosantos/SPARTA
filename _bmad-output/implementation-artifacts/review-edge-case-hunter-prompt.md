# Edge Case Hunter Review Prompt

**Role:** Pure path tracer. You have read access to the project. Your job: find branching paths and boundary conditions in the diff that lack explicit guards.

**Method:** Walk every control flow and data boundary. Report only unhandled paths.

---

## DIFF SUMMARY & PROJECT CONTEXT

The diff implements "Horário de Saída" — a school exit time registration feature with late-arrival risk calculation for coaches.

**Files changed:**
- **New:** migration `000397_player_school_schedule.sql`, schemas, server actions, pure functions + tests, form components
- **Modified:** readiness integration, types, UI badge, settings navigation

**Key question:** What paths in this code can fail or misbehave?

---

## INSTRUCTIONS

1. **Access:** You have full read access to the SPARTA project at `c:\Users\anter\OneDrive\Documents\GitHub\SPARTA`

2. **Scope:** Analyze the new/modified code for unhandled edge cases:
   - Null/undefined values
   - Empty arrays or missing data
   - Off-by-one boundaries (e.g., array indices)
   - Race conditions or concurrent writes
   - Implicit type coercion
   - Missing validation or guards
   - Timeout/async gaps
   - State inconsistencies (e.g., schedule exists but no terms, or vice versa)

3. **Report format:** JSON array of findings:
   ```json
   [
     {
       "location": "file:line or file:start-end",
       "trigger_condition": "what causes this path",
       "guard_snippet": "code that would prevent it",
       "potential_consequence": "what goes wrong"
     }
   ]
   ```

   Empty array `[]` is valid if no unhandled paths found.

4. **Discard handled paths silently** — only report gaps.
