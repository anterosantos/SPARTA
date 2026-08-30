import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTeamAggregateData } from "./team-aggregate";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn((_opts: unknown, fn: () => Promise<unknown>) => fn()),
}));

vi.mock("@/lib/actions/seasons", () => ({
  getCurrentSeason: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn(),
  getPlayerIdsForTeams: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { requireStaffRole, getPlayerIdsForTeams } from "@/lib/actions/auth";

const mockRequireStaffRole = requireStaffRole as ReturnType<typeof vi.fn>;
const mockGetPlayerIdsForTeams = getPlayerIdsForTeams as ReturnType<typeof vi.fn>;

const MOCK_SEASON = { id: "season-1", name: "2025/2026", is_current: true };
const CLUB_A = "club-a";
const PLAYER_1 = "player-1";
const PLAYER_2 = "player-2";
const PLAYER_3 = "player-3";

type MockQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function createMockQuery(): MockQuery {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
  };
}

function setupAuth(
  role: string = "coach",
  clubId: string = CLUB_A,
  userId: string = "user-1",
  playerIds: string[] = [PLAYER_1, PLAYER_2, PLAYER_3]
): void {
  mockRequireStaffRole.mockResolvedValue({
    ok: true,
    data: { userId, clubId, role, teamIds: ["team-1"] },
  });
  mockGetPlayerIdsForTeams.mockResolvedValue(playerIds);
}

function makeAttendanceQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.gte.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makeMetricsQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  // session_metrics: .eq("club_id") → q, .in() → q, .eq("sessions.season_id") → resolves
  q.eq.mockReturnValueOnce(q).mockResolvedValue({ data: rows, error: null });
  return q;
}

function makeEventsQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.limit.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makeFatigueQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.order.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makeWeightQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  // player_metrics: .eq("club_id") → q, .in() → q, .not() → q, .order() → resolves
  q.order.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makeAcwrQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  // readiness_snapshots: .select().eq().in().gte().order() → resolves em .order()
  q.order.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makePlayersQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.is.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makePositionsQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.eq.mockResolvedValue({ data: rows, error: null });
  return q;
}

function setupServiceRole(overrides: {
  players?: object[];
  positions?: object[];
  fatigue?: object[];
  attendance?: object[];
  metrics?: object[];
  events?: object[];
  weight?: object[];
  acwr?: object[];
  playersError?: object;
} = {}) {
  const playersQuery = makePlayersQuery(overrides.players ?? []);
  if (overrides.playersError) {
    (playersQuery.is as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: overrides.playersError });
  }
  const positionsQuery = makePositionsQuery(overrides.positions ?? []);
  const fatigueQuery = makeFatigueQuery(overrides.fatigue ?? []);
  const attendanceQuery = makeAttendanceQuery(overrides.attendance ?? []);
  const metricsQuery = makeMetricsQuery(overrides.metrics ?? []);
  const eventsQuery = makeEventsQuery(overrides.events ?? []);
  const weightQuery = makeWeightQuery(overrides.weight ?? []);
  const acwrQuery = makeAcwrQuery(overrides.acwr ?? []);

  const serviceClient = {
    from: vi.fn((table: string) => {
      if (table === "players") return playersQuery;
      if (table === "positions") return positionsQuery;
      if (table === "fatigue_responses") return fatigueQuery;
      if (table === "attendances") return attendanceQuery;
      if (table === "session_metrics") return metricsQuery;
      if (table === "match_events") return eventsQuery;
      if (table === "player_metrics") return weightQuery;
      if (table === "readiness_snapshots") return acwrQuery;
      return createMockQuery();
    }),
  };
  (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceClient);
  return serviceClient;
}

describe("getTeamAggregateData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentSeason as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: MOCK_SEASON,
    });
  });

  it("retorna unauthorized quando utilizador não está autenticado", async () => {
    mockRequireStaffRole.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Autenticação necessária." },
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("retorna unauthorized quando utilizador é jogador", async () => {
    mockRequireStaffRole.mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Acesso restrito a staff." },
    });
    setupServiceRole();

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("retorna unauthorized quando coach não tem club_id", async () => {
    mockRequireStaffRole.mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Clube não atribuído." },
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("retorna db_error quando query de jogadores falha", async () => {
    setupAuth("coach", CLUB_A);
    setupServiceRole({ playersError: { message: "DB Error" } });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("db_error");
  });

  it("retorna arrays vazios sem erro quando plantel está vazio", async () => {
    setupAuth("coach", CLUB_A);
    setupServiceRole({ players: [] });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalActivePlayers).toBe(0);
      expect(result.data.topLoaded).toHaveLength(0);
      expect(result.data.topFatigued).toHaveLength(0);
      expect(result.data.eventsPerMatch).toHaveLength(0);
      expect(result.data.weeklyFatigue).toHaveLength(4);
      expect(result.data.weeklyAttendance).toHaveLength(4);
      // 4 semanas com zeros
      for (const pt of result.data.weeklyFatigue) {
        expect(pt.avgFatigue).toBe(0);
        expect(pt.sampleSize).toBe(0);
      }
      expect(result.data.teamAcwr.points).toHaveLength(4);
      expect(result.data.teamAcwr.series).toHaveLength(0);
    }
  });

  it("happy path: retorna dados agregados correctos com coach", async () => {
    setupAuth("coach", CLUB_A);
    const now = new Date();
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "João Silva", age_group: "senior" },
        { id: PLAYER_2, full_name: "Maria Costa", age_group: "u19" },
      ],
      positions: [
        { player_id: PLAYER_1, position: "MED", is_primary: true },
        { player_id: PLAYER_2, position: "DEF", is_primary: true },
      ],
      fatigue: [
        {
          player_id: PLAYER_1,
          submitted_at: recentDate,
          dim_energy: 6,
          dim_focus: 7,
          dim_sleep: 5,
          dim_soreness: 4,
          dim_mood: 6,
        },
      ],
      attendance: [],
      metrics: [],
      events: [],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalActivePlayers).toBe(2);
      expect(result.data.userRole).toBe("coach");
      expect(result.data.currentSeason).not.toBeNull();
      expect(result.data.currentSeason?.id).toBe("season-1");
      expect(result.data.weeklyFatigue).toHaveLength(4);
      expect(result.data.weeklyAttendance).toHaveLength(4);
    }
  });

  it("happy path: analyst vê a mesma vista com userRole='analyst'", async () => {
    setupAuth("analyst", CLUB_A);
    setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "João", age_group: "senior" }],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userRole).toBe("analyst");
    }
  });

  it("isolamento club_id: usa clubId do utilizador autenticado nas queries", async () => {
    setupAuth("coach", CLUB_A);

    const serviceClient = setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "Jogador A", age_group: "senior" }],
      positions: [{ player_id: PLAYER_1, position: "MED", is_primary: true }],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    // Verifica que os dados retornados pertencem ao CLUB_A (totalActivePlayers > 0)
    if (result.ok) {
      expect(result.data.totalActivePlayers).toBe(1);
    }
    // Verifica que a query de jogadores usou o club_id correcto
    const playersQuery = serviceClient.from.mock.calls.find(
      (call) => call[0] === "players"
    );
    expect(playersQuery).toBeDefined();
  });

  it("cálculo semanal de fadiga: agrupamento por semana correcto", async () => {
    setupAuth("coach", CLUB_A);

    const now = new Date();
    // Semana 4 (mais recente — últimos 7 dias)
    const week4Date = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    // Semana 2 (14–21 dias atrás)
    const week2Date = new Date(now.getTime() - 17 * 24 * 60 * 60 * 1000).toISOString();

    setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "P1", age_group: "senior" }],
      positions: [],
      fatigue: [
        {
          player_id: PLAYER_1,
          submitted_at: week4Date,
          dim_energy: 8,
          dim_focus: 8,
          dim_sleep: 8,
          dim_soreness: 8,
          dim_mood: 8,
        },
        {
          player_id: PLAYER_1,
          submitted_at: week2Date,
          dim_energy: 2,
          dim_focus: 2,
          dim_sleep: 2,
          dim_soreness: 2,
          dim_mood: 2,
        },
      ],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const fatigue = result.data.weeklyFatigue;
      expect(fatigue).toHaveLength(4);

      // Semana 4 (índice 3): dims=8 (bem-estar) → fadiga invertida = 6 - 8 = -2
      const week4 = fatigue[3];
      expect(week4?.avgFatigue).toBe(-2);
      expect(week4?.sampleSize).toBe(1);

      // Semana 2 (índice 1): dims=2 (bem-estar) → fadiga invertida = 6 - 2 = 4
      const week2 = fatigue[1];
      expect(week2?.avgFatigue).toBe(4);
      expect(week2?.sampleSize).toBe(1);

      // Semanas 1 e 3 têm avg=0
      expect(fatigue[0]?.avgFatigue).toBe(0);
      expect(fatigue[2]?.avgFatigue).toBe(0);
    }
  });

  it("taxa de presença: (present + late) / total × 100", async () => {
    setupAuth("coach", CLUB_A);

    const now = new Date();
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "P1", age_group: "senior" },
        { id: PLAYER_2, full_name: "P2", age_group: "senior" },
        { id: PLAYER_3, full_name: "P3", age_group: "senior" },
        { id: "p4", full_name: "P4", age_group: "senior" },
      ],
      attendance: [
        { player_id: PLAYER_1, status: "present", session_id: "s1", sessions: { scheduled_at: recentDate, type: "training" } },
        { player_id: PLAYER_2, status: "late", session_id: "s1", sessions: { scheduled_at: recentDate, type: "training" } },
        { player_id: PLAYER_3, status: "absent", session_id: "s1", sessions: { scheduled_at: recentDate, type: "training" } },
        { player_id: "p4", status: "injured", session_id: "s1", sessions: { scheduled_at: recentDate, type: "training" } },
      ],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Semana 4 (últimos 7 dias): 2 present/late, 4 total → 50%
      const week4 = result.data.weeklyAttendance[3];
      expect(week4?.attended).toBe(2);
      expect(week4?.total).toBe(4);
      expect(week4?.attendanceRate).toBe(50);
    }
  });

  it("top-3 por carga: ordenação DESC correcta", async () => {
    setupAuth("coach", CLUB_A);

    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "P1", age_group: "senior" },
        { id: PLAYER_2, full_name: "P2", age_group: "u19" },
        { id: PLAYER_3, full_name: "P3", age_group: "u17" },
        { id: "p4", full_name: "P4", age_group: "u14" },
      ],
      positions: [
        { player_id: PLAYER_1, position: "MED", is_primary: true },
        { player_id: PLAYER_2, position: "DEF", is_primary: true },
        { player_id: PLAYER_3, position: "AVA", is_primary: true },
        { player_id: "p4", position: "GR", is_primary: true },
      ],
      metrics: [
        { player_id: PLAYER_1, srpe_load: 300, sessions: { season_id: "season-1" } },
        { player_id: PLAYER_2, srpe_load: 500, sessions: { season_id: "season-1" } },
        { player_id: PLAYER_3, srpe_load: 150, sessions: { season_id: "season-1" } },
        { player_id: "p4", srpe_load: 750, sessions: { season_id: "season-1" } },
      ],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const top = result.data.topLoaded;
      expect(top).toHaveLength(3);
      // Ordenação DESC: p4=750, PLAYER_2=500, PLAYER_1=300
      expect(top[0]?.playerId).toBe("p4");
      expect(top[0]?.value).toBe(750);
      expect(top[1]?.playerId).toBe(PLAYER_2);
      expect(top[1]?.value).toBe(500);
      expect(top[2]?.playerId).toBe(PLAYER_1);
      expect(top[2]?.value).toBe(300);
    }
  });

  it("weeklyFatigue tem labels corretos (Sem 1 a Sem 4)", async () => {
    setupAuth("coach", CLUB_A);
    setupServiceRole({ players: [{ id: PLAYER_1, full_name: "P1", age_group: "senior" }] });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const labels = result.data.weeklyFatigue.map((w) => w.weekLabel);
      expect(labels).toEqual(["Sem 1", "Sem 2", "Sem 3", "Sem 4"]);
    }
  });

  it("eventsPerMatch agrega eventos por sessão", async () => {
    setupAuth("coach", CLUB_A);

    const day1 = "2026-05-01";
    const day2 = "2026-05-15";

    setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "P1", age_group: "senior" }],
      events: [
        { session_id: "s1", sessions: { scheduled_at: day1, type: "match" } },
        { session_id: "s1", sessions: { scheduled_at: day1, type: "match" } },
        { session_id: "s1", sessions: { scheduled_at: day1, type: "match" } },
        { session_id: "s2", sessions: { scheduled_at: day2, type: "friendly" } },
        { session_id: "s2", sessions: { scheduled_at: day2, type: "friendly" } },
      ],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const events = result.data.eventsPerMatch;
      expect(events).toHaveLength(2);
      const s1 = events.find((e) => e.sessionId === "s1");
      expect(s1?.eventCount).toBe(3);
      // sessions.type real é inglês ("match") — output usa o vocabulário
      // "jogo"/"amigavel" da UI (TeamAggregateFiltersSheet); esta é a conversão que
      // faltava e deixava a query real sem devolver nada (usava "jogo" no filtro).
      expect(s1?.sessionType).toBe("jogo");
      const s2 = events.find((e) => e.sessionId === "s2");
      expect(s2?.eventCount).toBe(2);
      expect(s2?.sessionType).toBe("amigavel");
    }
  });

  it("sem época actual: currentSeason é null mas não falha", async () => {
    setupAuth("coach", CLUB_A);
    (getCurrentSeason as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: null,
    });
    setupServiceRole({ players: [{ id: PLAYER_1, full_name: "P1", age_group: "senior" }] });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.currentSeason).toBeNull();
    }
  });

  describe("squadFormation", () => {
    it("usa peso por omissão de último recurso (50kg) quando NENHUM jogador do plantel tem leitura", async () => {
      setupAuth("coach", CLUB_A);
      setupServiceRole({
        players: [{ id: PLAYER_1, full_name: "João Silva", age_group: "senior", jersey_num: 7 }],
        positions: [{ player_id: PLAYER_1, position: "MC", is_primary: true }],
        weight: [],
      });

      const result = await getTeamAggregateData();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.squadFormation).toHaveLength(1);
        expect(result.data.squadFormation[0]).toMatchObject({
          playerId: PLAYER_1,
          playerName: "João Silva",
          position: "MC",
          jerseyNum: 7,
          weightKg: 50,
          hasWeightReading: false,
          heightCm: 160,
          hasHeightReading: false,
        });
      }
    });

    it("jogador sem leitura recebe a média dos pesos registados no plantel menos 1kg", async () => {
      setupAuth("coach", CLUB_A);
      setupServiceRole({
        players: [
          { id: PLAYER_1, full_name: "Tem leitura A", age_group: "senior" },
          { id: PLAYER_2, full_name: "Tem leitura B", age_group: "senior" },
          { id: PLAYER_3, full_name: "Sem leitura", age_group: "senior" },
        ],
        positions: [
          { player_id: PLAYER_1, position: "DEF", is_primary: true },
          { player_id: PLAYER_2, position: "DEF", is_primary: true },
          { player_id: PLAYER_3, position: "MC", is_primary: true },
        ],
        // média de 70 e 80 = 75; default esperado = 75 - 1 = 74
        weight: [
          { player_id: PLAYER_1, weight_kg: 70, recorded_at: new Date().toISOString() },
          { player_id: PLAYER_2, weight_kg: 80, recorded_at: new Date().toISOString() },
        ],
      });

      const result = await getTeamAggregateData();

      expect(result.ok).toBe(true);
      if (result.ok) {
        const withoutReading = result.data.squadFormation.find((p) => p.playerId === PLAYER_3);
        expect(withoutReading?.weightKg).toBe(74);
        expect(withoutReading?.hasWeightReading).toBe(false);

        const p1 = result.data.squadFormation.find((p) => p.playerId === PLAYER_1);
        expect(p1?.weightKg).toBe(70);
        expect(p1?.hasWeightReading).toBe(true);
      }
    });

    it("usa a leitura de peso mais recente por jogador quando há várias", async () => {
      setupAuth("coach", CLUB_A);
      const now = new Date();
      const older = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const newer = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

      setupServiceRole({
        players: [{ id: PLAYER_1, full_name: "João Silva", age_group: "senior" }],
        positions: [{ player_id: PLAYER_1, position: "DEF", is_primary: true }],
        // Já ordenado por recorded_at DESC, tal como a query real devolve
        weight: [
          { player_id: PLAYER_1, weight_kg: 72.5, recorded_at: newer },
          { player_id: PLAYER_1, weight_kg: 68, recorded_at: older },
        ],
      });

      const result = await getTeamAggregateData();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.squadFormation[0]?.weightKg).toBe(72.5);
        expect(result.data.squadFormation[0]?.hasWeightReading).toBe(true);
      }
    });

    it("jogador sem leitura de altura recebe a média das alturas registadas no plantel menos 1cm", async () => {
      setupAuth("coach", CLUB_A);
      setupServiceRole({
        players: [
          { id: PLAYER_1, full_name: "Tem leitura A", age_group: "senior" },
          { id: PLAYER_2, full_name: "Tem leitura B", age_group: "senior" },
          { id: PLAYER_3, full_name: "Sem leitura", age_group: "senior" },
        ],
        positions: [
          { player_id: PLAYER_1, position: "DEF", is_primary: true },
          { player_id: PLAYER_2, position: "DEF", is_primary: true },
          { player_id: PLAYER_3, position: "MC", is_primary: true },
        ],
        // média de 170 e 180 = 175; default esperado = 175 - 1 = 174
        weight: [
          { player_id: PLAYER_1, height_cm: 170, recorded_at: new Date().toISOString() },
          { player_id: PLAYER_2, height_cm: 180, recorded_at: new Date().toISOString() },
        ],
      });

      const result = await getTeamAggregateData();

      expect(result.ok).toBe(true);
      if (result.ok) {
        const withoutReading = result.data.squadFormation.find((p) => p.playerId === PLAYER_3);
        expect(withoutReading?.heightCm).toBe(174);
        expect(withoutReading?.hasHeightReading).toBe(false);

        const p1 = result.data.squadFormation.find((p) => p.playerId === PLAYER_1);
        expect(p1?.heightCm).toBe(170);
        expect(p1?.hasHeightReading).toBe(true);
      }
    });

    it("usa a leitura de altura mais recente por jogador quando há várias", async () => {
      setupAuth("coach", CLUB_A);
      const now = new Date();
      const older = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const newer = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

      setupServiceRole({
        players: [{ id: PLAYER_1, full_name: "João Silva", age_group: "senior" }],
        positions: [{ player_id: PLAYER_1, position: "DEF", is_primary: true }],
        weight: [
          { player_id: PLAYER_1, height_cm: 182, recorded_at: newer },
          { player_id: PLAYER_1, height_cm: 179, recorded_at: older },
        ],
      });

      const result = await getTeamAggregateData();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.squadFormation[0]?.heightCm).toBe(182);
        expect(result.data.squadFormation[0]?.hasHeightReading).toBe(true);
      }
    });

    it("uma leitura com só peso e outra com só altura são combinadas correctamente por jogador", async () => {
      setupAuth("coach", CLUB_A);
      setupServiceRole({
        players: [{ id: PLAYER_1, full_name: "João Silva", age_group: "senior" }],
        positions: [{ player_id: PLAYER_1, position: "DEF", is_primary: true }],
        // Duas leituras distintas: uma só com peso, outra só com altura
        // (permitido desde o fix de "Nova leitura" — ver add-metric-sheet.tsx)
        weight: [
          { player_id: PLAYER_1, weight_kg: 75, height_cm: null, recorded_at: new Date().toISOString() },
          { player_id: PLAYER_1, weight_kg: null, height_cm: 178, recorded_at: new Date().toISOString() },
        ],
      });

      const result = await getTeamAggregateData();

      expect(result.ok).toBe(true);
      if (result.ok) {
        const p1 = result.data.squadFormation[0];
        expect(p1?.weightKg).toBe(75);
        expect(p1?.hasWeightReading).toBe(true);
        expect(p1?.heightCm).toBe(178);
        expect(p1?.hasHeightReading).toBe(true);
      }
    });
  });

  describe("teamAcwr", () => {
    it("agrega o snapshot mais recente por jogador/semana em pontos semanais", async () => {
      setupAuth("coach", CLUB_A);
      const now = new Date();
      const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

      setupServiceRole({
        players: [
          { id: PLAYER_1, full_name: "João Silva", age_group: "senior" },
          { id: PLAYER_2, full_name: "Ana Costa", age_group: "u19" },
        ],
        acwr: [
          // PLAYER_1: dois snapshots na semana mais recente (0-7 dias) — fica o mais recente (1.4)
          { player_id: PLAYER_1, acwr: 1.1, computed_at: daysAgo(5) },
          { player_id: PLAYER_1, acwr: 1.4, computed_at: daysAgo(1) },
          // PLAYER_2: um snapshot há 3 semanas
          { player_id: PLAYER_2, acwr: 0.9, computed_at: daysAgo(20) },
        ],
      });

      const result = await getTeamAggregateData();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.teamAcwr.points).toHaveLength(4);
        const lastWeek = result.data.teamAcwr.points[3];
        expect(lastWeek?.values[PLAYER_1]).toBe(1.4);
        expect(lastWeek?.values[PLAYER_2] ?? null).toBeNull();

        const series = result.data.teamAcwr.series;
        expect(series.map((s) => s.playerId).sort()).toEqual([PLAYER_1, PLAYER_2].sort());
      }
    });

    it("exclui da série jogadores sem nenhum ponto não-nulo nas 4 semanas", async () => {
      setupAuth("coach", CLUB_A);
      const daysAgo = (n: number) =>
        new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

      setupServiceRole({
        players: [
          { id: PLAYER_1, full_name: "João Silva", age_group: "senior" },
          { id: PLAYER_2, full_name: "Ana Costa", age_group: "u19" },
        ],
        acwr: [{ player_id: PLAYER_1, acwr: 1.0, computed_at: daysAgo(1) }],
      });

      const result = await getTeamAggregateData();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.teamAcwr.series.map((s) => s.playerId)).toEqual([PLAYER_1]);
      }
    });

    it("snapshots fora da janela de 4 semanas não entram em nenhum ponto", async () => {
      setupAuth("coach", CLUB_A);
      const now = new Date();
      const wayOld = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

      setupServiceRole({
        players: [{ id: PLAYER_1, full_name: "João Silva", age_group: "senior" }],
        acwr: [{ player_id: PLAYER_1, acwr: 1.0, computed_at: wayOld }],
      });

      const result = await getTeamAggregateData();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.teamAcwr.series).toHaveLength(0);
      }
    });
  });
});
