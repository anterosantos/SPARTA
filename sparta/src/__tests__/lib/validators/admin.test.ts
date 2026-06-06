import { describe, it, expect } from "vitest";
import {
  validateAgeGroupMobility,
  validateSeniorPlayerLimit,
  validateTeamPlayerAssignment,
  TeamPlayerAssignmentSchema,
} from "@/lib/validators/admin";

/**
 * Tests for Story 8.2 business rules
 *
 * AC #1: Age-based mobility
 * AC #2: Senior player team limits
 * AC #3: Server action validation
 */

describe("Admin Validators (Story 8.2)", () => {
  describe("AC #1: validateAgeGroupMobility", () => {
    it("allows upward movement (u14 → u19)", () => {
      const result = validateAgeGroupMobility("u14", "u19");
      expect(result.valid).toBe(true);
    });

    it("allows upward movement (u14 → senior)", () => {
      const result = validateAgeGroupMobility("u14", "senior");
      expect(result.valid).toBe(true);
    });

    it("blocks downward movement (u19 → u14)", () => {
      const result = validateAgeGroupMobility("u19", "u14");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("u19");
      expect(result.error).toContain("u14");
    });

    it("blocks downward movement (senior → u19)", () => {
      const result = validateAgeGroupMobility("senior", "u19");
      expect(result.valid).toBe(false);
    });

    it("allows same escalao (u14 → u14)", () => {
      const result = validateAgeGroupMobility("u14", "u14");
      expect(result.valid).toBe(true);
    });

    it("allows same escalao (u19 → u19)", () => {
      const result = validateAgeGroupMobility("u19", "u19");
      expect(result.valid).toBe(true);
    });

    it("allows all teams with no escalao (flexible teams)", () => {
      expect(validateAgeGroupMobility("u14", null).valid).toBe(true);
      expect(validateAgeGroupMobility("u19", undefined).valid).toBe(true);
      expect(validateAgeGroupMobility("senior", null).valid).toBe(true);
    });

    it("rejects invalid age groups", () => {
      const result = validateAgeGroupMobility("u99", "u19");
      expect(result.valid).toBe(false);
    });

    it("rejects invalid escalao", () => {
      const result = validateAgeGroupMobility("u14", "u99");
      expect(result.valid).toBe(false);
    });

    // Comprehensive matrix test
    it("age group hierarchy is respected: u13 < u14 < u15 < u16 < u17 < u19 < senior", () => {
      const groups = ["u13", "u14", "u15", "u16", "u17", "u19", "senior"];

      for (let i = 0; i < groups.length; i++) {
        for (let j = i; j < groups.length; j++) {
          const from = groups[i]!;
          const to = groups[j]!;
          const result = validateAgeGroupMobility(from, to);

          expect(result.valid).toBe(
            true,
            `${from} should be able to join ${to}`
          );
        }
      }

      // Downward movements should fail
      for (let i = 1; i < groups.length; i++) {
        const from = groups[i]!;
        const to = groups[i - 1]!;
        const result = validateAgeGroupMobility(from, to);

        expect(result.valid).toBe(
          false,
          `${from} should NOT be able to join ${to}`
        );
      }
    });
  });

  describe("AC #2: validateSeniorPlayerLimit", () => {
    it("allows first team when no B-team exists", () => {
      const result = validateSeniorPlayerLimit(0, false);
      expect(result.valid).toBe(true);
    });

    it("blocks second team when no B-team exists", () => {
      const result = validateSeniorPlayerLimit(1, false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Limite: 1");
    });

    it("allows first team when B-team exists", () => {
      const result = validateSeniorPlayerLimit(0, true);
      expect(result.valid).toBe(true);
    });

    it("allows second team when B-team exists", () => {
      const result = validateSeniorPlayerLimit(1, true);
      expect(result.valid).toBe(true);
    });

    it("blocks third team even when B-team exists", () => {
      const result = validateSeniorPlayerLimit(2, true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Limite: 2");
    });
  });

  describe("AC #3: TeamPlayerAssignmentSchema", () => {
    it("accepts valid input", () => {
      const input = {
        playerId: "550e8400-e29b-41d4-a716-446655440000",
        teamId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      };

      const result = TeamPlayerAssignmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts input with position", () => {
      const input = {
        playerId: "550e8400-e29b-41d4-a716-446655440000",
        teamId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        position: "CB",
      };

      const result = TeamPlayerAssignmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects invalid playerId", () => {
      const input = {
        playerId: "not-a-uuid",
        teamId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      };

      const result = TeamPlayerAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects invalid teamId", () => {
      const input = {
        playerId: "550e8400-e29b-41d4-a716-446655440000",
        teamId: "invalid-uuid",
      };

      const result = TeamPlayerAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects position longer than 50 chars", () => {
      const input = {
        playerId: "550e8400-e29b-41d4-a716-446655440000",
        teamId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        position: "a".repeat(51),
      };

      const result = TeamPlayerAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("AC #3: validateTeamPlayerAssignment (integration)", () => {
    const validInput = {
      playerId: "550e8400-e29b-41d4-a716-446655440000",
      teamId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    };

    it("allows u14 player joining u19 team with no B-team", () => {
      const result = validateTeamPlayerAssignment(validInput, {
        playerAgeGroup: "u14",
        teamEscalao: "u19",
        playerIsActive: true,
        rosterHasBTeam: false,
        activeTeamsInRoster: 0,
      });

      expect(result.valid).toBe(true);
    });

    it("blocks u19 player joining u14 team", () => {
      const result = validateTeamPlayerAssignment(validInput, {
        playerAgeGroup: "u19",
        teamEscalao: "u14",
        playerIsActive: true,
        rosterHasBTeam: false,
        activeTeamsInRoster: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe("AGE_CONSTRAINT");
    });

    it("allows senior player joining second team when B-team exists", () => {
      const result = validateTeamPlayerAssignment(validInput, {
        playerAgeGroup: "senior",
        teamEscalao: "senior",
        playerIsActive: true,
        rosterHasBTeam: true,
        activeTeamsInRoster: 1,
      });

      expect(result.valid).toBe(true);
    });

    it("blocks senior player joining second team when no B-team", () => {
      const result = validateTeamPlayerAssignment(validInput, {
        playerAgeGroup: "senior",
        teamEscalao: "senior",
        playerIsActive: true,
        rosterHasBTeam: false,
        activeTeamsInRoster: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe("SENIOR_LIMIT");
    });

    it("blocks senior player joining third team even with B-team", () => {
      const result = validateTeamPlayerAssignment(validInput, {
        playerAgeGroup: "senior",
        teamEscalao: "senior",
        playerIsActive: true,
        rosterHasBTeam: true,
        activeTeamsInRoster: 2,
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe("SENIOR_LIMIT");
    });

    it("allows youth players multiple teams (no limit)", () => {
      const result = validateTeamPlayerAssignment(validInput, {
        playerAgeGroup: "u14",
        teamEscalao: "u14",
        playerIsActive: true,
        rosterHasBTeam: true,
        activeTeamsInRoster: 5, // Youth can be in many teams
      });

      expect(result.valid).toBe(true);
    });

    it("allows flexible team assignment (no escalao)", () => {
      const result = validateTeamPlayerAssignment(validInput, {
        playerAgeGroup: "u19",
        teamEscalao: null,
        playerIsActive: true,
        rosterHasBTeam: false,
        activeTeamsInRoster: 1,
      });

      expect(result.valid).toBe(true);
    });
  });
});
