import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
}));

vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn(),
}));

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffRole } from "@/lib/actions/auth";
import { getMatchSummary } from "@/lib/actions/match-summary";

const mockRequireStaffRole = requireStaffRole as ReturnType<typeof vi.fn>;
const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;

const USER_UUID = "01920a4b-c8d3-7000-9c4e-000000000010";
const CLUB_UUID = "01920a4b-c8d3-7000-9c4e-000000000020";
const SESSION_UUID = "01920a4b-c8d3-7000-9c4e-000000000030";
const PLAYER_A = "01920a4b-c8d3-7000-9c4e-000000000040";
const PLAYER_B = "01920a4b-c8d3-7000-9c4e-000000000041";

function setupAuth() {
  mockRequireStaffRole.mockResolvedValue({
    ok: true,
    data: { userId: USER_UUID, clubId: CLUB_UUID, role: "coach", teamIds: [] },
  });
}

function buildServiceRole(opts: {
  sessionData?: object | null;
  eventsData?: object[] | null;
  lineupsData?: object[] | null;
  minutesData?: object[] | null;
} = {}) {
  const {
    sessionData = {
      id: SESSION_UUID,
      opponent_name: "GD Benavente",
      scheduled_at: "2026-08-30T15:00:00Z",
      duration_min: 75,
      type: "friendly",
      status: "completed",
    },
    eventsData = [],
    lineupsData = [
      {
        player_id: PLAYER_A,
        role: "starter",
        shirt_num: 7,
        players: { full_name: "Jogador A", jersey_num: 7 },
      },
      {
        player_id: PLAYER_B,
        role: "starter",
        shirt_num: 10,
        players: { full_name: "Jogador B", jersey_num: 10 },
      },
    ],
    minutesData = [
      { player_id: PLAYER_A, minutes_played: 75 },
      { player_id: PLAYER_B, minutes_played: 75 },
    ],
  } = opts;

  const sessionChain: Record<string, unknown> = {};
  sessionChain["maybeSingle"] = vi.fn().mockResolvedValue({ data: sessionData, error: null });
  sessionChain["eq"] = vi.fn().mockReturnValue(sessionChain);
  sessionChain["select"] = vi.fn().mockReturnValue(sessionChain);

  const eventsChain: Record<string, unknown> = {};
  eventsChain["order"] = vi.fn().mockResolvedValue({ data: eventsData, error: null });
  eventsChain["eq"] = vi.fn().mockReturnValue(eventsChain);
  eventsChain["select"] = vi.fn().mockReturnValue(eventsChain);

  const lineupsChain: Record<string, unknown> = {};
  lineupsChain["eq"] = vi.fn().mockResolvedValue({ data: lineupsData, error: null });
  lineupsChain["select"] = vi.fn().mockReturnValue(lineupsChain);

  const minutesChain: Record<string, unknown> = {};
  minutesChain["eq"] = vi.fn().mockResolvedValue({ data: minutesData, error: null });
  minutesChain["select"] = vi.fn().mockReturnValue(minutesChain);

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "sessions") return sessionChain;
      if (table === "match_events") return eventsChain;
      if (table === "match_lineups") return lineupsChain;
      if (table === "match_minutes_played") return minutesChain;
      return {};
    }),
  };
}

describe("getMatchSummary", () => {
  beforeEach(() => {
    mockGetServiceRoleClient.mockClear();
  });

  it("ordena match_events por occurred_at ascendente (chronológico real)", async () => {
    setupAuth();
    const serviceRole = buildServiceRole();
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    await getMatchSummary(SESSION_UUID);

    const eventsChain = serviceRole.from("match_events");
    expect(eventsChain.order).toHaveBeenCalledWith("occurred_at", { ascending: true });
  });

  it("golos ficam pela ordem devolvida pela query (occurred_at), não pelo campo minute", async () => {
    setupAuth();
    // occurred_at ascendente já vem da query — 2ª parte antes de 1ª parte
    // só aconteceria se a query não estivesse ordenada; aqui simulamos a
    // ordem correcta (cronológica) e confirmamos que sai tal-e-qual, sem
    // reordenar pelo campo opcional "minute".
    const eventsData = [
      {
        id: "e1",
        action: "goal",
        player_id: PLAYER_A,
        zone: "att_center",
        context: { period: 1, team: "own" }, // sem minute
        occurred_at: "2026-08-30T15:10:00Z",
      },
      {
        id: "e2",
        action: "goal",
        player_id: PLAYER_B,
        zone: "att_left",
        context: { period: 2, team: "own" }, // sem minute
        occurred_at: "2026-08-30T16:00:00Z",
      },
    ];
    const serviceRole = buildServiceRole({ eventsData });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await getMatchSummary(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.goals.map((g) => g.playerName)).toEqual(["Jogador A", "Jogador B"]);
    }
  });

  it("actionTotals inclui events com jogador e zona por tipo de acção", async () => {
    setupAuth();
    const eventsData = [
      {
        id: "e1",
        action: "corner",
        player_id: PLAYER_A,
        zone: "att_left",
        context: null,
        occurred_at: "2026-08-30T15:05:00Z",
      },
      {
        id: "e2",
        action: "corner",
        player_id: null,
        zone: "att_right",
        context: null,
        occurred_at: "2026-08-30T15:20:00Z",
      },
    ];
    const serviceRole = buildServiceRole({ eventsData });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await getMatchSummary(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const corner = result.data.actionTotals.find((a) => a.action === "corner");
      expect(corner?.count).toBe(2);
      expect(corner?.events).toEqual([
        { playerName: "Jogador A", jerseyNum: 7, zone: "att_left" },
        { playerName: null, jerseyNum: null, zone: "att_right" },
      ]);
    }
  });

  it("acções sem eventos têm events como array vazio", async () => {
    setupAuth();
    const serviceRole = buildServiceRole({ eventsData: [] });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await getMatchSummary(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const stat of result.data.actionTotals) {
        expect(stat.events).toEqual([]);
        expect(stat.count).toBe(0);
      }
    }
  });

  it("retorna not_found se sessão não existe", async () => {
    setupAuth();
    const serviceRole = buildServiceRole({ sessionData: null });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await getMatchSummary(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });
});
