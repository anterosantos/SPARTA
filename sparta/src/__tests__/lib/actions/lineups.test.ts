import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Zod validation tests for the lineup submission schema
 * These tests validate the input validation logic without requiring database mocks.
 *
 * A Convocatória só define QUEM está convocado (sem distinção titular/suplente —
 * essa escolha passou para setStartingLineup, no início da captura de eventos).
 * Replica aqui a mesma forma de PlayersArraySchema em lib/actions/lineups.ts.
 */

describe("Lineup Validation Schema", () => {
  const SubmitLineupSchema = z.object({
    sessionId: z.string().uuid("ID de sessão inválido"),
    players: z
      .array(
        z.object({
          playerId: z.string().uuid("ID de jogador inválido"),
          shirtNum: z
            .number()
            .int("Número de camisola inválido")
            .positive("Número de camisola tem de ser entre 1 e 99")
            .max(99, "Número de camisola tem de ser entre 1 e 99")
            .nullable()
            .optional(),
        })
      )
      .min(1, "Pelo menos um jogador é necessário"),
  });

  describe("Valid inputs", () => {
    it("should accept a list of convocados", () => {
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";
      const validData = {
        sessionId,
        players: Array.from({ length: 11 }, (_, i) => {
          const paddedI = String(i).padStart(4, "0");
          return {
            playerId: `550e8400-e29b-41d4-a716-44665544${paddedI}`,
            shirtNum: i + 1,
          };
        }),
      };

      const result = SubmitLineupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept fewer or more than 11 convocados (no starter/bench split here)", () => {
      const players = Array.from({ length: 14 }, (_, i) => ({
        playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
        shirtNum: i + 1,
      }));

      const result = SubmitLineupSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players,
      });

      expect(result.success).toBe(true);
    });

    it("should accept a single convocado", () => {
      const validData = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: [
          { playerId: "550e8400-e29b-41d4-a716-446655440001", shirtNum: 1 },
        ],
      };

      const result = SubmitLineupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept optional shirtNum", () => {
      const validData = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: Array.from({ length: 11 }, (_, i) => ({
          playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
          // shirtNum omitted
        })),
      };

      const result = SubmitLineupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("Invalid inputs - player list", () => {
    it("should reject zero players", () => {
      const result = SubmitLineupSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Pelo menos um jogador");
      }
    });
  });

  describe("Invalid inputs - UUID format", () => {
    it("should reject invalid sessionId", () => {
      const invalidData = {
        sessionId: "not-a-uuid",
        players: [
          { playerId: "550e8400-e29b-41d4-a716-446655440000" },
        ],
      };

      const result = SubmitLineupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("sessão");
      }
    });

    it("should reject invalid playerId", () => {
      const invalidData = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: [
          { playerId: "invalid-uuid" },
        ],
      };

      const result = SubmitLineupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Invalid inputs - shirtNum constraints", () => {
    it("should reject zero shirtNum with a friendly message (not a raw Zod default)", () => {
      const players = Array.from({ length: 11 }, (_, i) => ({
        playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
        shirtNum: i === 0 ? 0 : i + 1, // First player has 0 — e.g. jersey_num unset on profile
      }));

      const result = SubmitLineupSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Número de camisola tem de ser entre 1 e 99"
        );
      }
    });

    it("should reject shirtNum > 99", () => {
      const players = Array.from({ length: 11 }, (_, i) => ({
        playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
        shirtNum: i === 0 ? 100 : i + 1,
      }));

      const result = SubmitLineupSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players,
      });

      expect(result.success).toBe(false);
    });

    it("should accept shirtNum 1-99", () => {
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";
      const validData = {
        sessionId,
        players: Array.from({ length: 11 }, (_, i) => {
          const paddedI = String(i).padStart(4, "0");
          return {
            playerId: `550e8400-e29b-41d4-a716-44665544${paddedI}`,
            shirtNum: i + 1,
          };
        }),
      };

      const result = SubmitLineupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

/**
 * setStartingLineup — escolhe os 11 titulares de entre os convocados, no início da
 * captura de eventos. Replica a forma de SetStartingLineupSchema em lib/actions/lineups.ts.
 */
describe("Starting Lineup Validation Schema", () => {
  const SetStartingLineupSchema = z.object({
    sessionId: z.string().uuid("ID de sessão inválido"),
    starterPlayerIds: z
      .array(z.string().uuid("ID de jogador inválido"))
      .length(11, "Deve seleccionar exactamente 11 titulares"),
  });

  it("should accept exactly 11 starter ids", () => {
    const starterPlayerIds = Array.from({ length: 11 }, (_, i) => {
      const paddedI = String(i).padStart(4, "0");
      return `550e8400-e29b-41d4-a716-44665544${paddedI}`;
    });

    const result = SetStartingLineupSchema.safeParse({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      starterPlayerIds,
    });

    expect(result.success).toBe(true);
  });

  it("should reject fewer than 11 starter ids", () => {
    const result = SetStartingLineupSchema.safeParse({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      starterPlayerIds: ["550e8400-e29b-41d4-a716-446655440001"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("11 titulares");
    }
  });

  it("should reject more than 11 starter ids", () => {
    const starterPlayerIds = Array.from({ length: 12 }, (_, i) => {
      const paddedI = String(i).padStart(4, "0");
      return `550e8400-e29b-41d4-a716-44665544${paddedI}`;
    });

    const result = SetStartingLineupSchema.safeParse({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      starterPlayerIds,
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid player id", () => {
    const starterPlayerIds = Array.from({ length: 10 }, (_, i) => {
      const paddedI = String(i).padStart(4, "0");
      return `550e8400-e29b-41d4-a716-44665544${paddedI}`;
    }).concat("invalid-uuid");

    const result = SetStartingLineupSchema.safeParse({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      starterPlayerIds,
    });

    expect(result.success).toBe(false);
  });
});
