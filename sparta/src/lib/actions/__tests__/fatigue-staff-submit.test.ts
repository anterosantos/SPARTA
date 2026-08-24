/**
 * fatigue-staff-submit.test.ts — Testes para submitFatigueResponseByStaff() e para o
 * helper partilhado writeFatigueResponseSideEffects() (spec-staff-mediated-fatigue-
 * questionnaire.md).
 *
 * Cobre:
 * - submitFatigueResponseByStaff: ok, unauthorized, not_found (fora do âmbito, ou jogador
 *   não encontrado/arquivado), processing_restricted, session type rejeitado,
 *   session status rejeitado (cancelled, e pre após scheduled), post rejeitado quando
 *   ausente, validation
 * - Resubmissão actualiza a mesma linha (onConflict na chave real) tanto para o caminho
 *   self como staff
 * - Submissão em modo staff NUNCA chama attendances.update (presença não é tocada)
 * - Submissão em modo self CONTINUA a chamar attendances.update na fase pre (regressão)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  getRequestUser: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createServerClient, getRequestUser } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  submitFatigueResponse,
  submitFatigueResponseByStaff,
} from "@/lib/actions/fatigue";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLAYER_UUID = "550e8400-e29b-41d4-a716-446655440001";
const SESSION_UUID = "650e8400-e29b-41d4-a716-446655440002";
const FATIGUE_UUID = "750e8400-e29b-41d4-a716-446655440003";
const CLUB_UUID = "850e8400-e29b-41d4-a716-446655440004";
const STAFF_USER_UUID = "950e8400-e29b-41d4-a716-446655440005";
const TEAM_UUID = "150e8400-e29b-41d4-a716-446655440006";

const VALID_STAFF_PAYLOAD = {
  id: FATIGUE_UUID,
  player_id: PLAYER_UUID,
  session_id: SESSION_UUID,
  phase: "pre" as const,
  dim_energy: 4,
  dim_focus: 3,
  dim_sleep: 5,
  dim_soreness: 2,
  dim_mood: 4,
  submitted_via: "online" as const,
};

// ─── Helpers de mock ──────────────────────────────────────────────────────────

/** Query-builder mock "thenable" — encadeável (select/eq/in/is/order/update) e
 * resolve para `result` quando aguardado directamente ou via .maybeSingle()/.single(). */
function chainable(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select = vi.fn(self);
  obj.eq = vi.fn(self);
  obj.in = vi.fn(self);
  obj.is = vi.fn(self);
  obj.order = vi.fn(self);
  obj.limit = vi.fn(self);
  obj.update = vi.fn(self);
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  obj.single = vi.fn(() => Promise.resolve(result));
  obj.then = (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return obj;
}

interface BuildOpts {
  role?: string | null;
  clubId?: string | null;
  teamIds?: string[];
  playerInTeam?: boolean;
  playerRow?: object | null;
  sessionRow?: object | null;
  attendanceRow?: object | null;
  fatigueUpsertError?: { message: string } | null;
}

function buildStaffMockClients(opts?: BuildOpts) {
  const role = opts?.role === undefined ? "coach" : opts.role;
  const clubId = opts?.clubId === undefined ? CLUB_UUID : opts.clubId;
  const teamIds = opts?.teamIds ?? [TEAM_UUID];
  const playerInTeam = opts?.playerInTeam ?? true;
  const playerRow =
    opts?.playerRow !== undefined
      ? opts.playerRow
      : {
          id: PLAYER_UUID,
          club_id: CLUB_UUID,
          archived_at: null,
          processing_restricted: false,
        };
  const sessionRow =
    opts?.sessionRow !== undefined
      ? opts.sessionRow
      : {
          id: SESSION_UUID,
          club_id: CLUB_UUID,
          type: "training",
          status: "scheduled",
          scheduled_at: "2026-01-01T10:00:00Z",
          duration_min: 90,
        };
  const attendanceRow = opts?.attendanceRow !== undefined ? opts.attendanceRow : null;

  // createServerClient — usado por requireStaffRole() (profiles) e por getSessionById
  // (via getAuthContext: profiles + sessions)
  const serverClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: STAFF_USER_UUID } } }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return chainable({
          data: role ? { role, club_id: clubId } : null,
          error: null,
        });
      }
      if (table === "sessions") {
        return chainable({ data: sessionRow, error: null });
      }
      return chainable({ data: null, error: null });
    }),
  };

  const mockFatigueUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: opts?.fatigueUpsertError ?? null,
  });
  const mockAuditInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSessionMetricsUpsert = vi.fn().mockResolvedValue({ data: null, error: null });

  const attendanceSelectChain = chainable({ data: attendanceRow, error: null });
  const attendanceUpdateChain = chainable({ data: null, error: null });
  const mockAttendanceSelect = vi.fn(() => attendanceSelectChain);
  const mockAttendanceUpdate = vi.fn(() => attendanceUpdateChain);

  const serviceRoleClient = {
    from: vi.fn((table: string) => {
      if (table === "team_coaches") {
        return chainable({ data: teamIds.map((t) => ({ team_id: t })), error: null });
      }
      if (table === "team_players") {
        return chainable({
          data: playerInTeam ? [{ player_id: PLAYER_UUID }] : [],
          error: null,
        });
      }
      if (table === "players") {
        return chainable({ data: playerRow, error: null });
      }
      if (table === "attendances") {
        return { select: mockAttendanceSelect, update: mockAttendanceUpdate };
      }
      if (table === "fatigue_responses") {
        return { upsert: mockFatigueUpsert };
      }
      if (table === "session_metrics") {
        return { upsert: mockSessionMetricsUpsert };
      }
      if (table === "audit_logs") {
        return { insert: mockAuditInsert };
      }
      // sessions (lookup dentro de writeFatigueResponseSideEffects para session_metrics)
      // e qualquer outra tabela não explicitamente tratada (ex: readiness_snapshots)
      return chainable({ data: sessionRow, error: null });
    }),
  };

  return {
    serverClient,
    serviceRoleClient,
    mockFatigueUpsert,
    mockAuditInsert,
    mockSessionMetricsUpsert,
    mockAttendanceSelect,
    mockAttendanceUpdate,
    role,
    clubId,
  };
}

/** Aguarda microtasks/macrotasks pendentes (necessário para fire-and-forget) */
async function flushAsync() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function mockClients(opts?: BuildOpts) {
  const mocks = buildStaffMockClients(opts);
  vi.mocked(createServerClient).mockResolvedValue(mocks.serverClient as never);
  vi.mocked(getServiceRoleClient).mockReturnValue(mocks.serviceRoleClient as never);
  // getSessionById (sessions.ts) usa getRequestUser() — mesmo resultado que
  // serverClient.auth.getUser() + serverClient.from("profiles") produziriam.
  vi.mocked(getRequestUser).mockResolvedValue({
    supabase: mocks.serverClient,
    user: { id: STAFF_USER_UUID },
    profile: mocks.role ? { id: STAFF_USER_UUID, role: mocks.role, club_id: mocks.clubId } : null,
  } as never);
  return mocks;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("submitFatigueResponseByStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna ok({ id }) em submissão bem-sucedida", async () => {
    mockClients();
    const result = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(FATIGUE_UUID);
    }
  });

  it("retorna validation error para payload Zod inválido, sem chamar requireStaffRole", async () => {
    const mocks = mockClients();
    const result = await submitFatigueResponseByStaff({
      ...VALID_STAFF_PAYLOAD,
      dim_energy: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
    expect(mocks.serverClient.auth.getUser).not.toHaveBeenCalled();
  });

  it("retorna unauthorized quando staff não está autenticado", async () => {
    mockClients({ role: null });
    const result = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("retorna not_found quando jogador está fora do âmbito de equipas do staff (não revela existência)", async () => {
    mockClients({ playerInTeam: false });
    const result = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna not_found quando o jogador não existe/não pertence ao clube do staff", async () => {
    mockClients({ playerRow: null });
    const result = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna not_found quando o jogador está arquivado", async () => {
    mockClients({
      playerRow: {
        id: PLAYER_UUID,
        club_id: CLUB_UUID,
        archived_at: "2026-01-01T00:00:00Z",
        processing_restricted: false,
      },
    });
    const result = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna processing_restricted com mensagem a referir o jogador (não 'os teus dados')", async () => {
    mockClients({
      playerRow: {
        id: PLAYER_UUID,
        club_id: CLUB_UUID,
        archived_at: null,
        processing_restricted: true,
      },
    });
    const result = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("processing_restricted");
      expect(result.error.message).not.toMatch(/os teus dados/i);
      expect(result.error.message).toMatch(/jogador/i);
    }
  });

  it("rejeita quando o tipo de sessão não requer questionário de fadiga (ex: lecture)", async () => {
    mockClients({
      sessionRow: {
        id: SESSION_UUID,
        club_id: CLUB_UUID,
        type: "lecture",
        status: "scheduled",
        scheduled_at: "2026-01-01T10:00:00Z",
        duration_min: 90,
      },
    });
    const result = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("session_invalid");
  });

  it("rejeita quando a sessão está cancelled", async () => {
    mockClients({
      sessionRow: {
        id: SESSION_UUID,
        club_id: CLUB_UUID,
        type: "training",
        status: "cancelled",
        scheduled_at: "2026-01-01T10:00:00Z",
        duration_min: 90,
      },
    });
    const result = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_invalid");
      expect(result.error.message).toMatch(/cancelada/i);
    }
  });

  it("rejeita fase pre quando a sessão já está completed", async () => {
    mockClients({
      sessionRow: {
        id: SESSION_UUID,
        club_id: CLUB_UUID,
        type: "training",
        status: "completed",
        scheduled_at: "2026-01-01T10:00:00Z",
        duration_min: 90,
      },
    });
    const result = await submitFatigueResponseByStaff({
      ...VALID_STAFF_PAYLOAD,
      phase: "pre",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("session_invalid");
  });

  it("aceita fase post quando a sessão está completed", async () => {
    mockClients({
      sessionRow: {
        id: SESSION_UUID,
        club_id: CLUB_UUID,
        type: "training",
        status: "completed",
        scheduled_at: "2026-01-01T10:00:00Z",
        duration_min: 90,
      },
      attendanceRow: null,
    });
    const result = await submitFatigueResponseByStaff({
      ...VALID_STAFF_PAYLOAD,
      phase: "post",
      srpe_value: 7,
    });
    expect(result.ok).toBe(true);
  });

  it("rejeita fase post quando o jogador está marcado 'absent' nessa sessão", async () => {
    mockClients({ attendanceRow: { status: "absent" } });
    const result = await submitFatigueResponseByStaff({
      ...VALID_STAFF_PAYLOAD,
      phase: "post",
      srpe_value: 6,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("player_absent");
    }
  });

  it("aceita fase post quando o jogador NÃO está ausente", async () => {
    mockClients({ attendanceRow: { status: "present" } });
    const result = await submitFatigueResponseByStaff({
      ...VALID_STAFF_PAYLOAD,
      phase: "post",
      srpe_value: 6,
    });
    expect(result.ok).toBe(true);
  });

  it("upsert usa onConflict na chave real (player_id,session_id,phase), não 'id'", async () => {
    const mocks = mockClients();
    await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);

    const call = mocks.mockFatigueUpsert.mock.calls[0];
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({
      onConflict: "player_id,session_id,phase",
      ignoreDuplicates: false,
    });
  });

  it("audit log grava actor_id do staff, target_id do jogador, e payload.via='staff'", async () => {
    const mocks = mockClients();
    await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    await flushAsync();

    expect(mocks.mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: STAFF_USER_UUID,
        target_id: PLAYER_UUID,
        payload: expect.objectContaining({ via: "staff" }),
      })
    );
  });

  it("NUNCA chama attendances.update em modo staff (presença não é tocada)", async () => {
    const mocks = mockClients();
    const result = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    await flushAsync();

    expect(result.ok).toBe(true);
    expect(mocks.mockAttendanceUpdate).not.toHaveBeenCalled();
  });

  it("resubmissão (novo id de cliente, mesmo player+session+phase) actualiza a mesma linha", async () => {
    const mocks = mockClients();

    const r1 = await submitFatigueResponseByStaff(VALID_STAFF_PAYLOAD);
    const r2 = await submitFatigueResponseByStaff({
      ...VALID_STAFF_PAYLOAD,
      id: "750e8400-e29b-41d4-a716-446655440099", // novo UUIDv7 gerado no cliente
      dim_energy: 5,
    });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(mocks.mockFatigueUpsert).toHaveBeenCalledTimes(2);
    for (const call of mocks.mockFatigueUpsert.mock.calls) {
      expect(call[1]).toMatchObject({ onConflict: "player_id,session_id,phase" });
    }
  });
});

describe("submitFatigueResponse (self) — regressão pós-extracção do helper partilhado", () => {
  const SELF_PAYLOAD = {
    id: FATIGUE_UUID,
    player_id: PLAYER_UUID,
    session_id: SESSION_UUID,
    phase: "pre" as const,
    dim_energy: 4,
    dim_focus: 3,
    dim_sleep: 5,
    dim_soreness: 2,
    dim_mood: 4,
    submitted_via: "online" as const,
  };

  function mockSelfServeClients() {
    const playerRow = { id: PLAYER_UUID, club_id: CLUB_UUID, processing_restricted: false };

    const serverClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: PLAYER_UUID } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: playerRow, error: null }),
          }),
        }),
      }),
    };

    const mockFatigueUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const attendanceUpdateChain = chainable({ data: null, error: null });
    const mockAttendanceUpdate = vi.fn(() => attendanceUpdateChain);

    const serviceRoleClient = {
      from: vi.fn((table: string) => {
        if (table === "fatigue_responses") return { upsert: mockFatigueUpsert };
        if (table === "attendances") return { update: mockAttendanceUpdate };
        if (table === "audit_logs") return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
        return chainable({ data: null, error: null });
      }),
    };

    vi.mocked(createServerClient).mockResolvedValue(serverClient as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(serviceRoleClient as never);

    return { mockFatigueUpsert, mockAttendanceUpdate };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upsert usa onConflict na chave real (player_id,session_id,phase)", async () => {
    const { mockFatigueUpsert } = mockSelfServeClients();
    await submitFatigueResponse(SELF_PAYLOAD);

    const call = mockFatigueUpsert.mock.calls[0];
    expect(call?.[1]).toMatchObject({
      onConflict: "player_id,session_id,phase",
      ignoreDuplicates: false,
    });
  });

  it("continua a chamar attendances.update na fase pre (transição sem_questionario→present)", async () => {
    const { mockAttendanceUpdate } = mockSelfServeClients();
    const result = await submitFatigueResponse(SELF_PAYLOAD);
    await flushAsync();

    expect(result.ok).toBe(true);
    expect(mockAttendanceUpdate).toHaveBeenCalledWith({ status: "present" });
  });

  it("resubmissão (novo id de cliente) actualiza a mesma linha, sem erro de constraint", async () => {
    const { mockFatigueUpsert } = mockSelfServeClients();

    const r1 = await submitFatigueResponse(SELF_PAYLOAD);
    const r2 = await submitFatigueResponse({
      ...SELF_PAYLOAD,
      id: "750e8400-e29b-41d4-a716-446655440098",
      dim_mood: 2,
    });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(mockFatigueUpsert).toHaveBeenCalledTimes(2);
  });
});
