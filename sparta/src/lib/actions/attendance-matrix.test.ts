import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAttendanceMatrixData } from "./attendance-matrix";

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn(),
  getPlayerIdsForTeams: vi.fn(),
}));

vi.mock("@/lib/actions/sessions", () => ({
  getSessionsForClub: vi.fn(),
}));

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffRole, getPlayerIdsForTeams } from "@/lib/actions/auth";
import { getSessionsForClub } from "@/lib/actions/sessions";

const mockRequireStaffRole = requireStaffRole as ReturnType<typeof vi.fn>;
const mockGetPlayerIdsForTeams = getPlayerIdsForTeams as ReturnType<typeof vi.fn>;
const mockGetSessionsForClub = getSessionsForClub as ReturnType<typeof vi.fn>;

const CLUB_A = "club-a";
const PLAYER_1 = "player-1";
const PLAYER_2 = "player-2";
const SESSION_1 = "session-1";
const SESSION_2 = "session-2";

type MockQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
};

function createMockQuery(): MockQuery {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  };
}

function makePlayersQuery(rows: object[], error: object | null = null): MockQuery {
  const q = createMockQuery();
  q.is.mockResolvedValue({ data: rows, error });
  return q;
}

function makePositionsQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.eq.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makeAttendancesQuery(rows: object[], error: object | null = null): MockQuery {
  const q = createMockQuery();
  // .select().eq("club_id").in("player_id").in("session_id") — second .in() resolves
  q.in.mockReturnValueOnce(q).mockResolvedValue({ data: rows, error });
  return q;
}

function setupAuth(
  teamIds: string[] = ["team-1"],
  playerIds: string[] = [PLAYER_1, PLAYER_2]
): void {
  mockRequireStaffRole.mockResolvedValue({
    ok: true,
    data: { userId: "user-1", clubId: CLUB_A, role: "coach", teamIds },
  });
  mockGetPlayerIdsForTeams.mockResolvedValue(playerIds);
}

function setupServiceRole(overrides: {
  players?: object[];
  playersError?: object;
  positions?: object[];
  attendance?: object[];
} = {}) {
  const playersQuery = makePlayersQuery(overrides.players ?? [], overrides.playersError ?? null);
  const positionsQuery = makePositionsQuery(overrides.positions ?? []);
  const attendancesQuery = makeAttendancesQuery(overrides.attendance ?? []);

  const serviceClient = {
    from: vi.fn((table: string) => {
      if (table === "players") return playersQuery;
      if (table === "positions") return positionsQuery;
      if (table === "attendances") return attendancesQuery;
      return createMockQuery();
    }),
  };
  (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceClient);
  return serviceClient;
}

describe("getAttendanceMatrixData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propaga erro quando requireStaffRole falha (jogador não staff)", async () => {
    mockRequireStaffRole.mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Acesso restrito a staff." },
    });

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
    expect(mockGetSessionsForClub).not.toHaveBeenCalled();
  });

  it("retorna dados vazios sem chamar sessões quando staff não tem jogadores atribuídos", async () => {
    setupAuth(["team-1"], []);
    setupServiceRole();

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.players).toHaveLength(0);
      expect(result.data.sessions).toHaveLength(0);
      expect(result.data.statusMap).toEqual({});
    }
    expect(mockGetSessionsForClub).not.toHaveBeenCalled();
  });

  it("propaga erro quando getSessionsForClub falha", async () => {
    setupAuth();
    setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "João", jersey_num: 7 }],
    });
    mockGetSessionsForClub.mockResolvedValue({
      ok: false,
      error: { code: "unknown", message: "Erro ao carregar sessões" },
    });

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("Erro ao carregar sessões");
  });

  it("sem sessões no período: statusMap vazio e não consulta attendances", async () => {
    setupAuth();
    const serviceClient = setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "João", jersey_num: 7 }],
    });
    mockGetSessionsForClub.mockResolvedValue({ ok: true, data: [] });

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sessions).toHaveLength(0);
      expect(result.data.statusMap).toEqual({});
    }
    const attendanceCall = serviceClient.from.mock.calls.find((call) => call[0] === "attendances");
    expect(attendanceCall).toBeUndefined();
  });

  it("ordena jogadores por dorsal ascendente, sem dorsal por último (sem posição definida)", async () => {
    setupAuth();
    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "Sem dorsal", jersey_num: null },
        { id: PLAYER_2, full_name: "Dorsal 3", jersey_num: 3 },
        { id: "player-3", full_name: "Dorsal 1", jersey_num: 1 },
      ],
    });
    mockGetSessionsForClub.mockResolvedValue({ ok: true, data: [] });

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.players.map((p) => p.id)).toEqual(["player-3", PLAYER_2, PLAYER_1]);
    }
  });

  it("ordena por posição (GK/DEF/MID/FWD) antes do dorsal — um FWD de dorsal baixo não passa à frente do GK", async () => {
    setupAuth(["team-1"], [PLAYER_1, PLAYER_2]);
    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "Avançado", jersey_num: 1 },
        { id: PLAYER_2, full_name: "Guarda-redes", jersey_num: 99 },
      ],
      positions: [
        { player_id: PLAYER_1, position: "FWD" },
        { player_id: PLAYER_2, position: "GK" },
      ],
    });
    mockGetSessionsForClub.mockResolvedValue({ ok: true, data: [] });

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.players.map((p) => p.id)).toEqual([PLAYER_2, PLAYER_1]);
    }
  });

  it("usa o nome como desempate final quando posição e dorsal são iguais/nulos", async () => {
    setupAuth(["team-1"], [PLAYER_1, PLAYER_2]);
    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "Zeca", jersey_num: null },
        { id: PLAYER_2, full_name: "Ana", jersey_num: null },
      ],
    });
    mockGetSessionsForClub.mockResolvedValue({ ok: true, data: [] });

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.players.map((p) => p.fullName)).toEqual(["Ana", "Zeca"]);
    }
  });

  it("nome em branco/só espaços cai para '—' em vez de ficar vazio", async () => {
    setupAuth(["team-1"], [PLAYER_1]);
    setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "   ", jersey_num: 5 }],
    });
    mockGetSessionsForClub.mockResolvedValue({ ok: true, data: [] });

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.players[0]?.fullName).toBe("—");
    }
  });

  it("propaga erro quando a query de posições falha", async () => {
    setupAuth(["team-1"], [PLAYER_1]);
    const serviceClient = setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "João", jersey_num: 7 }],
    });
    const positionsQuery = serviceClient.from("positions") as MockQuery;
    positionsQuery.eq.mockResolvedValue({
      data: null,
      error: { message: "erro de posições" },
    });
    mockGetSessionsForClub.mockResolvedValue({ ok: true, data: [] });

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("erro de posições");
  });

  it("happy path: constrói statusMap chave playerId:sessionId apenas para pares com registo", async () => {
    setupAuth();
    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "João", jersey_num: 7 },
        { id: PLAYER_2, full_name: "Maria", jersey_num: 10 },
      ],
      positions: [{ player_id: PLAYER_1, position: "MED" }],
      attendance: [
        { player_id: PLAYER_1, session_id: SESSION_1, status: "present" },
        { player_id: PLAYER_2, session_id: SESSION_1, status: "late" },
        // PLAYER_2 x SESSION_2 has no record — must be absent from the map
      ],
    });
    mockGetSessionsForClub.mockResolvedValue({
      ok: true,
      data: [
        { id: SESSION_2, type: "training", scheduled_at: "2026-08-15T10:00:00.000Z" },
        { id: SESSION_1, type: "training", scheduled_at: "2026-08-01T10:00:00.000Z" },
      ],
    });

    const result = await getAttendanceMatrixData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      // sessões ordenadas cronologicamente (SESSION_1 antes de SESSION_2)
      expect(result.data.sessions.map((s) => s.id)).toEqual([SESSION_1, SESSION_2]);
      expect(result.data.statusMap[`${PLAYER_1}:${SESSION_1}`]).toBe("present");
      expect(result.data.statusMap[`${PLAYER_2}:${SESSION_1}`]).toBe("late");
      expect(result.data.statusMap[`${PLAYER_2}:${SESSION_2}`]).toBeUndefined();
      expect(result.data.players.find((p) => p.id === PLAYER_1)?.position).toBe("MED");
    }
  });
});
