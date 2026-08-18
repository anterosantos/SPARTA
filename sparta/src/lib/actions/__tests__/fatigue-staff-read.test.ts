/**
 * fatigue-staff-read.test.ts — Testes para as leituras de suporte staff-mediadas
 * introduzidas por spec-staff-mediated-fatigue-questionnaire.md em fatigue-staff.ts:
 * getQuestionnaireEntryList, getPlayerForStaffQuestionnaire,
 * getPlayerAttendanceStatusForStaff, getExistingFatigueResponseForStaff.
 *
 * Cobre especificamente os achados da loopback #2:
 * - sessionId vazio/whitespace → 'validation' (não 'not_found')
 * - fatigue_responses filtrado também por club_id em getQuestionnaireEntryList
 * - archived_at IS NULL verificado nos helpers de leitura
 * - processing_restricted devolve erro claro (referindo o jogador) ANTES de
 *   qualquer leitura de dados de bem-estar
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn(),
  getPlayerIdsForTeams: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/actions/sessions", () => ({
  getSessionById: vi.fn(),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn((_opts: unknown, fn: () => Promise<unknown>) => fn()),
}));

import { requireStaffRole, getPlayerIdsForTeams } from "@/lib/actions/auth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getSessionById } from "@/lib/actions/sessions";
import {
  getQuestionnaireEntryList,
  getPlayerForStaffQuestionnaire,
  getPlayerAttendanceStatusForStaff,
  getExistingFatigueResponseForStaff,
} from "@/lib/actions/fatigue-staff";

const CLUB_ID = "850e8400-e29b-41d4-a716-446655440004";
const PLAYER_ID = "550e8400-e29b-41d4-a716-446655440001";
const SESSION_ID = "650e8400-e29b-41d4-a716-446655440002";
const TEAM_ID = "150e8400-e29b-41d4-a716-446655440006";
const USER_ID = "950e8400-e29b-41d4-a716-446655440005";

function mockAuthOk(teamIds: string[] = [TEAM_ID]) {
  vi.mocked(requireStaffRole).mockResolvedValue({
    ok: true,
    data: { userId: USER_ID, clubId: CLUB_ID, role: "coach", teamIds },
  });
}

function mockAuthFail(code: string) {
  vi.mocked(requireStaffRole).mockResolvedValue({
    ok: false,
    error: { code, message: "erro" },
  } as never);
}

/** Chainable com registo de chamadas .eq() para asserções de filtros (club_id, etc). */
function chainableTracking(result: { data: unknown; error: unknown }) {
  const eqCalls: Array<[string, unknown]> = [];
  const obj: Record<string, unknown> = {};
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn((col: string, val: unknown) => {
    eqCalls.push([col, val]);
    return obj;
  });
  obj.in = vi.fn(() => obj);
  obj.is = vi.fn(() => obj);
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  obj.then = (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  obj.__eqCalls = eqCalls;
  return obj;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getQuestionnaireEntryList ─────────────────────────────────────────────────

describe("getQuestionnaireEntryList", () => {
  it("retorna validation (não not_found) quando sessionId é vazio/whitespace", async () => {
    const result = await getQuestionnaireEntryList("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
    expect(requireStaffRole).not.toHaveBeenCalled();
  });

  it("propaga unauthorized quando o staff não está autenticado", async () => {
    mockAuthFail("unauthorized");
    const result = await getQuestionnaireEntryList(SESSION_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("retorna requiresQuestionnaire=false para sessão do tipo lecture", async () => {
    mockAuthOk();
    vi.mocked(getSessionById).mockResolvedValue({
      ok: true,
      data: { id: SESSION_ID, club_id: CLUB_ID, type: "lecture", status: "scheduled" },
    } as never);

    const result = await getQuestionnaireEntryList(SESSION_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.requiresQuestionnaire).toBe(false);
      expect(result.data.entries).toEqual([]);
    }
  });

  it("retorna requiresQuestionnaire=false com mensagem específica para sessão cancelada", async () => {
    mockAuthOk();
    vi.mocked(getSessionById).mockResolvedValue({
      ok: true,
      data: { id: SESSION_ID, club_id: CLUB_ID, type: "training", status: "cancelled" },
    } as never);

    const result = await getQuestionnaireEntryList(SESSION_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.requiresQuestionnaire).toBe(false);
      expect(result.data.entries).toEqual([]);
      expect(result.data.blockedMessage).toMatch(/cancelada/i);
    }
  });

  it("filtra fatigue_responses também por club_id (defesa em profundidade)", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    vi.mocked(getSessionById).mockResolvedValue({
      ok: true,
      data: { id: SESSION_ID, club_id: CLUB_ID, type: "training", status: "scheduled" },
    } as never);

    const playersChain = chainableTracking({
      data: [{ id: PLAYER_ID, full_name: "Jogador Um", jersey_num: 7 }],
      error: null,
    });
    const responsesChain = chainableTracking({
      data: [{ player_id: PLAYER_ID, phase: "pre" }],
      error: null,
    });

    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "players") return playersChain;
        if (table === "fatigue_responses") return responsesChain;
        return chainableTracking({ data: null, error: null });
      }),
    } as never);

    const result = await getQuestionnaireEntryList(SESSION_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.requiresQuestionnaire).toBe(true);
      expect(result.data.entries).toEqual([
        { playerId: PLAYER_ID, fullName: "Jogador Um", jerseyNum: 7, answeredPre: true, answeredPost: false },
      ]);
    }

    const eqCallsOnResponses = (responsesChain.__eqCalls as Array<[string, unknown]>);
    expect(eqCallsOnResponses).toContainEqual(["club_id", CLUB_ID]);
    expect(eqCallsOnResponses).toContainEqual(["session_id", SESSION_ID]);

    const eqCallsOnPlayers = (playersChain.__eqCalls as Array<[string, unknown]>);
    expect(eqCallsOnPlayers).toContainEqual(["club_id", CLUB_ID]);
  });
});

// ─── getPlayerForStaffQuestionnaire ────────────────────────────────────────────

describe("getPlayerForStaffQuestionnaire", () => {
  it("retorna not_found quando o jogador está fora do âmbito de equipas do staff", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue(["outro-jogador"]);

    const result = await getPlayerForStaffQuestionnaire(PLAYER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna not_found quando o jogador está arquivado", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() =>
        chainableTracking({
          data: {
            id: PLAYER_ID,
            full_name: "Jogador Um",
            age_group: "senior",
            archived_at: "2026-01-01T00:00:00Z",
            processing_restricted: false,
          },
          error: null,
        })
      ),
    } as never);

    const result = await getPlayerForStaffQuestionnaire(PLAYER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna processing_restricted ANTES de expor dados de bem-estar, com mensagem a referir o jogador", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() =>
        chainableTracking({
          data: {
            id: PLAYER_ID,
            full_name: "Jogador Um",
            age_group: "senior",
            archived_at: null,
            processing_restricted: true,
          },
          error: null,
        })
      ),
    } as never);

    const result = await getPlayerForStaffQuestionnaire(PLAYER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("processing_restricted");
      expect(result.error.message).not.toMatch(/os teus dados/i);
      expect(result.error.message).toMatch(/jogador/i);
    }
  });

  it("retorna dados do jogador quando tudo válido", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() =>
        chainableTracking({
          data: {
            id: PLAYER_ID,
            full_name: "Jogador Um",
            age_group: "u14",
            archived_at: null,
            processing_restricted: false,
          },
          error: null,
        })
      ),
    } as never);

    const result = await getPlayerForStaffQuestionnaire(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: PLAYER_ID, fullName: "Jogador Um", ageGroup: "u14" });
    }
  });
});

// ─── getPlayerAttendanceStatusForStaff ─────────────────────────────────────────

describe("getPlayerAttendanceStatusForStaff", () => {
  it("retorna not_found quando o jogador está fora do âmbito", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([]);

    const result = await getPlayerAttendanceStatusForStaff(PLAYER_ID, SESSION_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna o status de presença quando existe registo", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() => chainableTracking({ data: { status: "absent" }, error: null })),
    } as never);

    const result = await getPlayerAttendanceStatusForStaff(PLAYER_ID, SESSION_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("absent");
  });

  it("retorna null quando não existe registo de presença", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "players") {
          return chainableTracking({
            data: { archived_at: null, processing_restricted: false },
            error: null,
          });
        }
        return chainableTracking({ data: null, error: null });
      }),
    } as never);

    const result = await getPlayerAttendanceStatusForStaff(PLAYER_ID, SESSION_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it("retorna not_found quando o jogador está arquivado (verificação independente, não só via âmbito)", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "players") {
          return chainableTracking({
            data: { archived_at: "2026-01-01T00:00:00Z", processing_restricted: false },
            error: null,
          });
        }
        return chainableTracking({ data: { status: "present" }, error: null });
      }),
    } as never);

    const result = await getPlayerAttendanceStatusForStaff(PLAYER_ID, SESSION_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

// ─── getExistingFatigueResponseForStaff ────────────────────────────────────────

describe("getExistingFatigueResponseForStaff", () => {
  it("retorna not_found quando o jogador está fora do âmbito", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([]);

    const result = await getExistingFatigueResponseForStaff(PLAYER_ID, SESSION_ID, "pre");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna null quando não existe resposta prévia", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "players") {
          return chainableTracking({
            data: { archived_at: null, processing_restricted: false },
            error: null,
          });
        }
        return chainableTracking({ data: null, error: null });
      }),
    } as never);

    const result = await getExistingFatigueResponseForStaff(PLAYER_ID, SESSION_ID, "pre");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it("retorna processing_restricted ANTES de ler dados de bem-estar (verificação independente)", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    const wellnessChain = chainableTracking({
      data: { dim_energy: 5, dim_focus: 5, dim_sleep: 5, dim_soreness: 5, dim_mood: 5 },
      error: null,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "players") {
          return chainableTracking({
            data: { archived_at: null, processing_restricted: true },
            error: null,
          });
        }
        return wellnessChain;
      }),
    } as never);

    const result = await getExistingFatigueResponseForStaff(PLAYER_ID, SESSION_ID, "pre");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("processing_restricted");
    // A query de bem-estar nunca deve ser invocada quando processing_restricted bloqueia primeiro
    expect(wellnessChain.select).not.toHaveBeenCalled();
  });

  it("retorna os valores de dimensões existentes, filtrados também por club_id", async () => {
    mockAuthOk();
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    const responseRow = {
      dim_energy: 4,
      dim_focus: 3,
      dim_sleep: 5,
      dim_soreness: 2,
      dim_mood: 4,
      srpe_value: null,
      muscle_pain_zones: null,
      has_exams_this_week: false,
    };
    const chain = chainableTracking({ data: responseRow, error: null });
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as never);

    const result = await getExistingFatigueResponseForStaff(PLAYER_ID, SESSION_ID, "pre");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(responseRow);

    const eqCalls = chain.__eqCalls as Array<[string, unknown]>;
    expect(eqCalls).toContainEqual(["club_id", CLUB_ID]);
  });
});
