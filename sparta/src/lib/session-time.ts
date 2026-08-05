/**
 * Computes the end instant of a session from its start + duration.
 * Display-only — duration is not persisted as an end time in the DB.
 */
export function sessionEndDate(scheduledAt: string, durationMin: number): Date {
  return new Date(new Date(scheduledAt).getTime() + durationMin * 60000);
}
