/**
 * Admin validators (Story 8.2)
 *
 * Zod schemas for validating:
 * - Age-based team mobility (AC #1)
 * - Senior player team limits (AC #2)
 * - Team player assignment (AC #3)
 */

import { z } from "zod";

// Age group hierarchy for mobility validation (AC #1)
const AgeGroupHierarchy: Record<string, number> = {
  u13: 0,
  u14: 1,
  u15: 2,
  u16: 3,
  u17: 4,
  u19: 5,
  senior: 6,
};

/**
 * AC #1: Age-based mobility validation
 *
 * Rules:
 * - Player u14 CANNOT join u13 (downward movement blocked)
 * - Player u14 CAN join u15, u16, u17, u19, senior (upward)
 * - Same escalao unrestricted (u14 → u14 OK)
 */
export function validateAgeGroupMobility(
  playerAgeGroup: string,
  teamEscalao: string | null | undefined
): { valid: boolean; error?: string } {
  // H-1 FIX: If team has no escalao, it's a flexible/multi-age team
  // This intentionally allows any age group. Coaches decide team composition.
  if (!teamEscalao) {
    return { valid: true };
  }

  const playerLevel = AgeGroupHierarchy[playerAgeGroup];
  const teamLevel = AgeGroupHierarchy[teamEscalao];

  // Invalid age groups
  if (playerLevel === undefined || teamLevel === undefined) {
    return { valid: false, error: "Invalid age group or escalao" };
  }

  // Downward movement not allowed (e.g., u19 → u14)
  if (playerLevel > teamLevel) {
    return {
      valid: false,
      error: `Escalão ${playerAgeGroup} não pode jogar ${teamEscalao}`,
    };
  }

  // Same level or upward movement allowed
  return { valid: true };
}

/**
 * AC #2: Senior player team limits
 *
 * Rules:
 * - If roster has B-team: senior can be in max 2 teams
 * - If roster has no B-team: senior can be in max 1 team
 *
 * @param activeTeamsCount Number of active teams player is already in this roster
 * @param hasBTeam Whether roster has any team with is_b_team=true
 */
export function validateSeniorPlayerLimit(
  activeTeamsCount: number,
  hasBTeam: boolean
): { valid: boolean; error?: string } {
  const maxTeams = hasBTeam ? 2 : 1;

  if (activeTeamsCount >= maxTeams) {
    return {
      valid: false,
      error: `Jogador sénior já está em ${activeTeamsCount} equipa(s). Limite: ${maxTeams}`,
    };
  }

  return { valid: true };
}

/**
 * AC #3: Team player assignment validator
 *
 * Full Zod schema with refine() for complex validation
 */
export const TeamPlayerAssignmentSchema = z.object({
  playerId: z.string().uuid("Invalid player ID"),
  teamId: z.string().uuid("Invalid team ID"),
  position: z.string().max(50).optional(),
});

export type TeamPlayerAssignmentInput = z.infer<
  typeof TeamPlayerAssignmentSchema
>;

// Context required for validation (passed at runtime)
export interface TeamPlayerValidationContext {
  playerAgeGroup: string;
  teamEscalao: string | null;
  playerIsActive: boolean;
  rosterHasBTeam: boolean;
  activeTeamsInRoster: number;
}

/**
 * Full validation combining age mobility + senior limits
 */
export function validateTeamPlayerAssignment(
  input: TeamPlayerAssignmentInput,
  context: TeamPlayerValidationContext
): { valid: boolean; error?: string; code?: string } {
  // Validate age mobility (AC #1)
  const ageCheck = validateAgeGroupMobility(
    context.playerAgeGroup,
    context.teamEscalao
  );
  if (!ageCheck.valid) {
    return { valid: false, error: ageCheck.error, code: "AGE_CONSTRAINT" };
  }

  // Validate senior limits (AC #2) — only for senior players (age_group='senior')
  if (context.playerAgeGroup === "senior" && context.playerIsActive) {
    const seniorCheck = validateSeniorPlayerLimit(
      context.activeTeamsInRoster,
      context.rosterHasBTeam
    );
    if (!seniorCheck.valid) {
      return {
        valid: false,
        error: seniorCheck.error,
        code: "SENIOR_LIMIT",
      };
    }
  }

  return { valid: true };
}
