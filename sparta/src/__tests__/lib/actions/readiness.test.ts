/**
 * readiness.test.ts — Testes unitários para Server Actions de readiness.
 *
 * Garante que o princípio "dados mediados" é tecnicamente enforçado:
 * - Players recebem "Não autorizado" — sem dados derivados directos
 * - Staff (coach/analyst) pode chamar as actions
 * - Utilizadores não autenticados recebem erro
 *
 * AC #2 (Story 4.6): Server Action authorization check
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn((opts, fn) => fn()),
}));

vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn(),
  getPlayerIdsForTeams: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { requireStaffRole, getPlayerIdsForTeams } from "@/lib/actions/auth";
import { getPlayerReadinessSnapshot, getPlayerAcwrTrend } from "@/lib/actions/readiness";

const mockCreateServerClient = createServerClient as ReturnType<typeof vi.fn>;
const mockRequireStaffRole = requireStaffRole as ReturnType<typeof vi.fn>;
const mockGetPlayerIdsForTeams = getPlayerIdsForTeams as ReturnType<typeof vi.fn>;

function buildNullSnapshotClient() {
  const chain: Record<string, unknown> = {};
  chain["select"] = vi.fn().mockReturnValue(chain);
  chain["eq"] = vi.fn().mockReturnValue(chain);
  chain["order"] = vi.fn().mockReturnValue(chain);
  chain["limit"] = vi.fn().mockReturnValue(chain);
  chain["maybeSingle"] = vi.fn().mockResolvedValue({ data: null, error: null });
  return { from: vi.fn().mockReturnValue(chain) };
}

const PLAYER_UUID = "550e8400-e29b-41d4-a716-446655440001";
const COACH_UUID  = "950e8400-e29b-41d4-a716-446655440005";
const CLUB_UUID   = "850e8400-e29b-41d4-a716-446655440004";

function setupAuth(opts: {
  userId?: string | null;
  role?: string | null;
  clubId?: string | null;
  profileError?: boolean;
} = {}) {
  const userId = opts.userId !== undefined ? opts.userId : COACH_UUID;
  const role   = opts.role   !== undefined ? opts.role   : "coach";
  const clubId = opts.clubId !== undefined ? opts.clubId : CLUB_UUID;

  const isValid = userId && (role === "coach" || role === "analyst") && clubId && !opts.profileError;

  if (!isValid) {
    mockRequireStaffRole.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Não autorizado" },
    });
    mockGetPlayerIdsForTeams.mockResolvedValue([]);
    mockCreateServerClient.mockResolvedValue(buildNullSnapshotClient());
  } else {
    mockRequireStaffRole.mockResolvedValue({
      ok: true,
      data: { userId, clubId, role, teamIds: [] },
    });
    // Return the player UUID so team membership check passes in happy path tests
    mockGetPlayerIdsForTeams.mockResolvedValue([PLAYER_UUID]);
    // createServerClient is still used by the action for the readiness_snapshots query
    mockCreateServerClient.mockResolvedValue(buildNullSnapshotClient());
  }
}

describe("readiness Server Actions — Dados Mediados Authorization (AC #2)", () => {
  beforeEach(() => {
    
  });

  // ─── getPlayerReadinessSnapshot ────────────────────────────────────────────

  describe("getPlayerReadinessSnapshot", () => {
    it("returns unauthorized error for player role (AC #2 — dados mediados block)", async () => {
      setupAuth({ role: "player" });

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
        // Generic error message — does NOT reveal data structure (FR26)
        expect(result.error.message).toBe("Não autorizado");
      }
    });

    it("returns unauthorized error for unknown role", async () => {
      setupAuth({ role: "unknown" });

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
      }
    });

    it("returns unauthorized error for unauthenticated user", async () => {
      setupAuth({ userId: null });

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
        expect(result.error.message).toBe("Não autorizado");
      }
    });

    it("returns unauthorized error when profile fetch fails", async () => {
      setupAuth({ profileError: true });

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
      }
    });

    it("returns unauthorized error when club_id is missing", async () => {
      setupAuth({ role: "coach", clubId: null });

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
      }
    });

    it("returns not_found for empty playerId", async () => {
      setupAuth();

      const result = await getPlayerReadinessSnapshot("");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("not_found");
      }
    });

    it("returns ok (stub) for coach with valid playerId (AC #2 — staff allowed)", async () => {
      setupAuth({ role: "coach" });

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.playerId).toBe(PLAYER_UUID);
        // Stub returns null snapshot (table created in Story 5.3)
        expect(result.data?.snapshot).toBeNull();
      }
    });

    it("returns ok (stub) for analyst with valid playerId (AC #2 — staff allowed)", async () => {
      setupAuth({ role: "analyst" });

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(true);
    });
  });

  // ─── getPlayerAcwrTrend ─────────────────────────────────────────────────────

  describe("getPlayerAcwrTrend", () => {
    it("returns unauthorized error for player role (ACWR is derived/processed data)", async () => {
      setupAuth({ role: "player" });

      const result = await getPlayerAcwrTrend(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
        expect(result.error.message).toBe("Não autorizado");
      }
    });

    it("returns ok (stub) for coach (staff may access ACWR trend)", async () => {
      setupAuth({ role: "coach" });

      const result = await getPlayerAcwrTrend(PLAYER_UUID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.playerId).toBe(PLAYER_UUID);
        expect(result.data?.trend).toBeNull();
      }
    });
  });

  // ─── Error message integrity ───────────────────────────────────────────────

  describe("Error message integrity (AC #2 — no data structure leakage)", () => {
    it("unauthorized error message is generic — does not reveal resource existence", async () => {
      setupAuth({ role: "player" });

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Must NOT contain hints like "you don't have permission" vs "data doesn't exist"
        expect(result.error.message).toBe("Não autorizado");
        expect(result.error.message).not.toContain("permissão");
        expect(result.error.message).not.toContain("exists");
        expect(result.error.message).not.toContain("found");
      }
    });

    it("unauthorized response does not include status code that reveals resource existence", async () => {
      setupAuth({ role: "player" });

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Code is "unauthorized", not "not_found" — consistent for all player attempts
        expect(result.error.code).toBe("unauthorized");
      }
    });
  });
});
