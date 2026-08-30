import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  getRequestUser: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

vi.mock("@/lib/actions/seasons", () => ({
  getCurrentSeason: vi.fn(),
}));

// requireStaffRole is used by getSessionsForClub; mock directly to avoid
// internal getServiceRoleClient chain for team_coaches
vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn(),
}));

import { createServerClient, getRequestUser } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { requireStaffRole } from "@/lib/actions/auth";
import {
  getSessionsForClub,
  getSessionById,
  createSession,
  updateSession,
  cancelSession,
} from "@/lib/actions/sessions";

const mockRequireStaffRole = requireStaffRole as ReturnType<typeof vi.fn>;
const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;

// getRequestUser() substitui o antigo getAuthContext() privado de sessions.ts — em vez
// de reconfigurar cada teste, replica aqui o mesmo caminho (createServerClient() mockado
// por cada teste → auth.getUser() → profiles.select().single()), para todos os testes
// existentes continuarem a funcionar sem alteração.
vi.mocked(getRequestUser).mockImplementation(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, club_id")
    .eq("id", user.id)
    .single();
  return { supabase, user, profile };
});

const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const CLUB_UUID = "650e8400-e29b-41d4-a716-446655440002";
const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";
const SEASON_UUID = "850e8400-e29b-41d4-a716-446655440004";

const FUTURE_AT = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const mockSession = {
  id: SESSION_UUID,
  club_id: CLUB_UUID,
  season_id: SEASON_UUID,
  type: "training",
  scheduled_at: FUTURE_AT,
  duration_min: 90,
  location: "Campo Municipal",
  status: "scheduled",
  notes: null,
  created_by: USER_UUID,
  created_at: "2026-05-19T00:00:00Z",
};

const mockCurrentSeason = {
  id: SEASON_UUID,
  club_id: CLUB_UUID,
  name: "2026/27",
  start_date: "2026-08-01",
  end_date: "2027-06-30",
  is_current: true,
  created_at: "2026-05-01T00:00:00Z",
};

function makeSupabaseMock({
  user = { id: USER_UUID },
  profile = { club_id: CLUB_UUID, id: USER_UUID },
  sessionData = mockSession,
  sessionsList = [mockSession],
  queryError = null,
}: {
  user?: { id: string } | null;
  profile?: { club_id: string; id: string } | null;
  sessionData?: typeof mockSession | null;
  sessionsList?: typeof mockSession[];
  queryError?: { message: string } | null;
} = {}) {
  const sessionsMock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: sessionsList,
      error: queryError,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: sessionData,
      error: queryError,
    }),
    single: vi.fn().mockResolvedValue({
      data: sessionData,
      error: queryError,
    }),
    // createSession() agora termina em .insert(rows).select("*") (sem .single()),
    // para suportar repetição semanal (várias linhas). Torna o próprio mock
    // "thenable" para que `await chain.insert(...).select(...)` resolva
    // directamente, sem quebrar as outras cadeias que já terminam em
    // .maybeSingle()/.single()/.order() explicitamente.
    then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
      resolve({ data: sessionsList, error: queryError }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        };
      }
      return sessionsMock;
    }),
  };
}

// ─── getSessionsForClub ───────────────────────────────────────────────────────

const PLAYER_UUID = "950e8400-e29b-41d4-a716-446655440005";
const TEAM_UUID = "a50e8400-e29b-41d4-a716-446655440006";

// Helpers for getSessionsForClub (role-branches: coach/analyst → requireStaffRole,
// player → own team_players lookup, via getServiceRoleClient)
function setupSessionsForClub({
  sessionsList = [mockSession],
  role = "coach",
  playerTeamIds = [],
}: {
  sessionsList?: typeof mockSession[];
  role?: "coach" | "analyst" | "player";
  playerTeamIds?: string[];
} = {}) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role, club_id: CLUB_UUID }, error: null }),
    }),
  } as never);

  if (role === "coach" || role === "analyst") {
    mockRequireStaffRole.mockResolvedValue({
      ok: true,
      data: { userId: USER_UUID, clubId: CLUB_UUID, role, teamIds: [] },
    });
  }

  // getServiceRoleClient is used for the sessions query, session_teams query,
  // and (player role only) the players + team_players lookup.
  // session_teams returns empty → all sessions visible (no team restriction)
  mockGetServiceRoleClient.mockReturnValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "session_teams") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === "players") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: PLAYER_UUID }, error: null }),
        };
      }
      if (table === "team_players") {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: { data: { team_id: string }[]; error: null }) => void) =>
            resolve({ data: playerTeamIds.map((tid) => ({ team_id: tid })), error: null }),
        };
        return chain;
      }
      // sessions query
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: sessionsList, error: null }),
      };
    }),
  });
}

describe("getSessionsForClub", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve lista de sessões para utilizador autenticado (staff)", async () => {
    setupSessionsForClub({ sessionsList: [mockSession] });

    const result = await getSessionsForClub();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.type).toBe("training");
    }
  });

  it("devolve lista de sessões para jogador autenticado", async () => {
    setupSessionsForClub({ sessionsList: [mockSession], role: "player" });

    const result = await getSessionsForClub();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
    }
  });

  it("devolve erro unauthorized quando não autenticado", async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never);

    const result = await getSessionsForClub();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("devolve erro forbidden quando perfil não encontrado", async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } }, error: null }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as never);

    const result = await getSessionsForClub();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("devolve erro forbidden para role desconhecido (ex.: admin)", async () => {
    setupSessionsForClub({ sessionsList: [mockSession] });
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } }, error: null }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "admin", club_id: CLUB_UUID }, error: null }),
      }),
    } as never);

    const result = await getSessionsForClub();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("filtra por type=training quando passado", async () => {
    const trainingSession = { ...mockSession, type: "training" };
    setupSessionsForClub({ sessionsList: [trainingSession] });

    const result = await getSessionsForClub({ type: "training" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.every((s) => s.type === "training")).toBe(true);
    }
  });

  it("filtra por type=match quando passado", async () => {
    const matchSession = { ...mockSession, type: "match" };
    setupSessionsForClub({ sessionsList: [matchSession] });

    const result = await getSessionsForClub({ type: "match" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.type).toBe("match");
    }
  });

  it("devolve todas as sessões quando type não é passado", async () => {
    const mixed = [
      { ...mockSession, type: "training" },
      { ...mockSession, id: "id2", type: "match" },
    ];
    setupSessionsForClub({ sessionsList: mixed });

    const result = await getSessionsForClub();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
    }
  });

  it("aceita filtros opcionais (season_id, status)", async () => {
    setupSessionsForClub({ sessionsList: [] });

    const result = await getSessionsForClub({
      season_id: SEASON_UUID,
      status: "scheduled",
    });
    expect(result.ok).toBe(true);
  });

  it("jogador só vê sessões da sua equipa quando a sessão tem equipas atribuídas", async () => {
    const OTHER_TEAM_UUID = "b50e8400-e29b-41d4-a716-446655440007";
    const ownTeamSession = { ...mockSession, id: "session-own-team" };
    const otherTeamSession = { ...mockSession, id: "session-other-team" };
    const noTeamSession = { ...mockSession, id: "session-no-team" };

    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "player", club_id: CLUB_UUID }, error: null }),
      }),
    } as never);

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "session_teams") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { session_id: "session-own-team", team_id: TEAM_UUID },
                { session_id: "session-other-team", team_id: OTHER_TEAM_UUID },
              ],
              error: null,
            }),
          };
        }
        if (table === "players") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: PLAYER_UUID }, error: null }),
          };
        }
        if (table === "team_players") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: (v: { data: { team_id: string }[]; error: null }) => void) =>
              resolve({ data: [{ team_id: TEAM_UUID }], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [ownTeamSession, otherTeamSession, noTeamSession],
            error: null,
          }),
        };
      }),
    });

    const result = await getSessionsForClub();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.data.map((s) => s.id);
      expect(ids).toContain("session-own-team");
      expect(ids).toContain("session-no-team");
      expect(ids).not.toContain("session-other-team");
    }
  });
});

// ─── getSessionById ───────────────────────────────────────────────────────────

describe("getSessionById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve sessão quando existe", async () => {
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSessionById(SESSION_UUID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(SESSION_UUID);
  });

  it("devolve not_found quando sessão não existe", async () => {
    const mock = makeSupabaseMock({ sessionData: null });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSessionById(SESSION_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

// ─── createSession ────────────────────────────────────────────────────────────

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  const validInput = {
    type: "training" as const,
    scheduledAt: FUTURE_AT,
    durationMin: 90,
  };

  it("cria sessão com sucesso quando existe época actual", async () => {
    vi.mocked(getCurrentSeason).mockResolvedValue({
      ok: true,
      data: mockCurrentSeason,
    });
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as never);

    const result = await createSession(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.type).toBe("training");
  });

  it("devolve no_season quando não há época actual", async () => {
    vi.mocked(getCurrentSeason).mockResolvedValue({ ok: true, data: null });
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await createSession(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_season");
  });

  it("devolve validation error com tipo inválido", async () => {
    const result = await createSession({
      ...validInput,
      type: "invalid" as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });

  it("repeatWeekly=true com repeatWeeks gera N sessões espaçadas por 7 dias", async () => {
    vi.mocked(getCurrentSeason).mockResolvedValue({
      ok: true,
      data: mockCurrentSeason,
    });
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as never);

    const result = await createSession({
      ...validInput,
      repeatWeekly: true,
      repeatWeeks: 3,
    });

    expect(result.ok).toBe(true);
    const sessionsTable = mock.from("sessions");
    const insertCall = vi.mocked(sessionsTable.insert).mock.calls[0]!;
    const insertedRows = insertCall[0] as { scheduled_at: string }[];
    expect(insertedRows).toHaveLength(3);
    const base = new Date(FUTURE_AT).getTime();
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    expect(new Date(insertedRows[0]!.scheduled_at).getTime()).toBe(base);
    expect(new Date(insertedRows[1]!.scheduled_at).getTime()).toBe(base + ONE_WEEK_MS);
    expect(new Date(insertedRows[2]!.scheduled_at).getTime()).toBe(base + 2 * ONE_WEEK_MS);
  });

  it("repeatWeekly=false (omissão) insere apenas 1 sessão", async () => {
    vi.mocked(getCurrentSeason).mockResolvedValue({
      ok: true,
      data: mockCurrentSeason,
    });
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as never);

    await createSession(validInput);

    const sessionsTable = mock.from("sessions");
    const insertCall = vi.mocked(sessionsTable.insert).mock.calls[0]!;
    const insertedRows = insertCall[0] as unknown[];
    expect(insertedRows).toHaveLength(1);
  });

  it("devolve validation error se repeatWeekly=true sem indicar repeatWeeks", async () => {
    const result = await createSession({
      ...validInput,
      repeatWeekly: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });

  it("devolve validation error com data muito passada", async () => {
    const oldDate = new Date(
      Date.now() - 48 * 60 * 60 * 1000
    ).toISOString();
    const result = await createSession({ ...validInput, scheduledAt: oldDate });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });

  it("devolve unauthorized quando não autenticado", async () => {
    vi.mocked(getCurrentSeason).mockResolvedValue({
      ok: true,
      data: mockCurrentSeason,
    });
    const mock = makeSupabaseMock({ user: null });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await createSession(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });
});

// ─── updateSession ────────────────────────────────────────────────────────────

describe("updateSession", () => {
  beforeEach(() => vi.clearAllMocks());

  const validInput = {
    id: SESSION_UUID,
    type: "match" as const,
    scheduledAt: FUTURE_AT,
    durationMin: 60,
  };

  it("actualiza sessão com sucesso", async () => {
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as never);

    const result = await updateSession(validInput);
    expect(result.ok).toBe(true);
  });

  it("bloqueia actualização de sessão cancelada", async () => {
    const cancelledSession = { ...mockSession, status: "cancelled" };
    const mock = makeSupabaseMock({ sessionData: cancelledSession });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await updateSession(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("bloqueia actualização de sessão concluída", async () => {
    const completedSession = { ...mockSession, status: "completed" };
    const mock = makeSupabaseMock({ sessionData: completedSession });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await updateSession(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("devolve validation error com id inválido", async () => {
    const result = await updateSession({ ...validInput, id: "not-a-uuid" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });
});

// ─── cancelSession ────────────────────────────────────────────────────────────

describe("cancelSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancela sessão agendada com sucesso", async () => {
    const mock = makeSupabaseMock({
      sessionData: { ...mockSession, status: "cancelled" },
    });
    // First call (getSessionById) returns scheduled, second call (update) returns cancelled
    let callCount = 0;
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID, id: USER_UUID },
            error: null,
          }),
        };
      }
      callCount++;
      if (callCount === 1) {
        // getSessionById call
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { ...mockSession, status: "scheduled" },
            error: null,
          }),
        };
      }
      // cancelSession update call
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockSession, status: "cancelled" },
          error: null,
        }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(mock as never);

    const result = await cancelSession(SESSION_UUID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("cancelled");
  });

  it("bloqueia cancelamento de sessão já cancelada", async () => {
    const mock = makeSupabaseMock({
      sessionData: { ...mockSession, status: "cancelled" },
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await cancelSession(SESSION_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("devolve not_found quando sessão não existe", async () => {
    const mock = makeSupabaseMock({ sessionData: null });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await cancelSession(SESSION_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});
