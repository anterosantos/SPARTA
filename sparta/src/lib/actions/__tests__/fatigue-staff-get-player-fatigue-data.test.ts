/**
 * fatigue-staff-get-player-fatigue-data.test.ts — Regressão para getPlayerFatigueData()
 * (fatigue-staff.ts), usada por /plantel/[id]/fadiga.
 *
 * Bug corrigido: a verificação de âmbito de equipa usava .maybeSingle() numa query
 * team_players filtrada por team_id IN (...) + player_id — que falha silenciosamente
 * (PGRST116, erro descartado ao destructurar só `data`) quando o jogador pertence a
 * mais do que uma equipa do mesmo treinador. Resultado: not_found para um jogador com
 * acesso legítimo, sempre que houvesse sobreposição de equipas — reportado em produção
 * como 404 em TODOS os jogadores para uma conta cujo treinador tinha múltiplas equipas.
 * Corrigido para reutilizar getPlayerIdsForTeams() (mesmo padrão de getPlayer() em
 * players.ts), que não sofre desta limitação.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn(),
  getPlayerIdsForTeams: vi.fn(),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn((_opts: unknown, fn: () => Promise<unknown>) => fn()),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getPlayerIdsForTeams } from "@/lib/actions/auth";
import { getPlayerFatigueData } from "@/lib/actions/fatigue-staff";

const CLUB_ID = "850e8400-e29b-41d4-a716-446655440004";
const PLAYER_ID = "550e8400-e29b-41d4-a716-446655440001";
const USER_ID = "950e8400-e29b-41d4-a716-446655440005";
const TEAM_A = "150e8400-e29b-41d4-a716-446655440006";
const TEAM_B = "250e8400-e29b-41d4-a716-446655440007";

/** Chainable simples: qualquer método de encadeamento devolve o próprio objecto. */
function chainable(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.in = vi.fn(() => obj);
  obj.gte = vi.fn(() => obj);
  obj.order = vi.fn(() => Promise.resolve(result));
  obj.single = vi.fn(() => Promise.resolve(result));
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  obj.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return obj;
}

function mockRlsClient(profileData: { role: string; club_id: string } | null, playerData: unknown) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn((table: string) => {
      if (table === "profiles") return chainable({ data: profileData, error: null });
      if (table === "players") return chainable({ data: playerData, error: null });
      return chainable({ data: null, error: null });
    }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPlayerFatigueData — âmbito de equipa (regressão do bug de multi-equipa)", () => {
  it("sucesso quando o jogador pertence a UMA equipa do treinador", async () => {
    mockRlsClient(
      { role: "coach", club_id: CLUB_ID },
      { id: PLAYER_ID, full_name: "Jogador Um", club_id: CLUB_ID }
    );
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "team_coaches") {
          return chainable({ data: [{ team_id: TEAM_A }], error: null });
        }
        if (table === "fatigue_responses") return chainable({ data: [], error: null });
        if (table === "sessions") return chainable({ data: [], error: null });
        return chainable({ data: null, error: null });
      }),
    } as never);

    const result = await getPlayerFatigueData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.playerName).toBe("Jogador Um");
  });

  it("sucesso quando o jogador pertence a DUAS equipas do treinador (bug: antes devolvia not_found)", async () => {
    mockRlsClient(
      { role: "coach", club_id: CLUB_ID },
      { id: PLAYER_ID, full_name: "Jogador Multi-Equipa", club_id: CLUB_ID }
    );
    // getPlayerIdsForTeams (lista, imune a múltiplas linhas) confirma o jogador no âmbito
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue([PLAYER_ID, "outro-jogador"]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "team_coaches") {
          // Treinador atribuído a DUAS equipas
          return chainable({ data: [{ team_id: TEAM_A }, { team_id: TEAM_B }], error: null });
        }
        if (table === "fatigue_responses") return chainable({ data: [], error: null });
        if (table === "sessions") return chainable({ data: [], error: null });
        return chainable({ data: null, error: null });
      }),
    } as never);

    const result = await getPlayerFatigueData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.playerName).toBe("Jogador Multi-Equipa");
  });

  it("retorna not_found quando o jogador não está em nenhuma equipa do treinador", async () => {
    mockRlsClient(
      { role: "coach", club_id: CLUB_ID },
      { id: PLAYER_ID, full_name: "Jogador Fora", club_id: CLUB_ID }
    );
    vi.mocked(getPlayerIdsForTeams).mockResolvedValue(["outro-jogador"]);
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "team_coaches") return chainable({ data: [{ team_id: TEAM_A }], error: null });
        return chainable({ data: null, error: null });
      }),
    } as never);

    const result = await getPlayerFatigueData(PLAYER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna not_found quando o treinador não tem nenhuma equipa atribuída", async () => {
    mockRlsClient(
      { role: "coach", club_id: CLUB_ID },
      { id: PLAYER_ID, full_name: "Jogador Um", club_id: CLUB_ID }
    );
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "team_coaches") return chainable({ data: [], error: null });
        return chainable({ data: null, error: null });
      }),
    } as never);

    const result = await getPlayerFatigueData(PLAYER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
    expect(getPlayerIdsForTeams).not.toHaveBeenCalled();
  });
});
