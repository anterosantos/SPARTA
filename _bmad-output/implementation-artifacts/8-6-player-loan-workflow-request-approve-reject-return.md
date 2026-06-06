---
story_id: "8.6"
story_key: "8-6-player-loan-workflow-request-approve-reject-return"
epic: "Epic 8"
status: "ready-for-dev"
---
# Story 8.6: Player Loan Workflow — Request, Approve, Reject, Return

Request/approve/reject/return player loans with full audit trail.

## Acceptance Criteria

- requestPlayerLoan(playerId, fromTeamId, toTeamId, note?) → creates pending loan, logs
- approvePlayerLoan(loanId, note?) → sets status='approved', approved_by=auth.uid(), logs
- rejectPlayerLoan(loanId, note) → sets status='rejected', logs
- returnPlayerLoan(loanId) → sets status='returned', returned_at=now(), logs
- Audit all transitions

**Completed:** Ultimate context engine analysis ✅

---

## Implementation Summary

### Server Actions (Story 8.6) ✅

**File:** `sparta/src/lib/actions/admin.ts`

1. **requestPlayerLoan(playerId, fromTeamId, toTeamId, note?)**
   - Creates pending loan request
   - Verifies both teams in same club
   - Logs audit entry

2. **approvePlayerLoan(loanId, note?)**
   - Changes status: pending → approved
   - Sets approved_by + approved_at
   - Validates status is pending
   - Logs audit entry

3. **rejectPlayerLoan(loanId, note)**
   - Changes status: pending → rejected
   - Note required (rejection reason)
   - Validates status is pending
   - Logs audit entry

4. **returnPlayerLoan(loanId)**
   - Changes status: approved → returned
   - Sets returned_at timestamp
   - Validates status is approved
   - Logs audit entry

### Acceptance Criteria

- ✅ requestPlayerLoan creates pending + logs
- ✅ approvePlayerLoan transitions + logs
- ✅ rejectPlayerLoan transitions + logs
- ✅ returnPlayerLoan transitions + logs
- ✅ Audit all state transitions

### Ready for Code Review

Story 8.6 is complete.
