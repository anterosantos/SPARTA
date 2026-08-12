import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/actions/sessions", () => ({
  getSessionById: vi.fn(),
}));

vi.mock("@/lib/actions/player-attendance", () => ({
  getPlayerAttendanceForSession: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getSessionById } from "@/lib/actions/sessions";
import { getPlayerAttendanceForSession } from "@/lib/actions/player-attendance";
import PlayerSessionDetailPage from "@/app/(player)/agenda/[sessionId]/page";

const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";
const CLUB_UUID = "650e8400-e29b-41d4-a716-446655440002";
const SEASON_UUID = "850e8400-e29b-41d4-a716-446655440004";
const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";

const BASE_SESSION = {
  id: SESSION_UUID,
  club_id: CLUB_UUID,
  season_id: SEASON_UUID,
  type: "medical" as const,
  scheduled_at: "2026-08-17T18:00:00.000Z",
  duration_min: 45,
  location: "Posto Médico do Complexo Desportivo Real SC",
  status: "scheduled" as const,
  notes: null as string | null,
  created_by: USER_UUID,
  created_at: "2026-08-01T00:00:00Z",
  concentration_time: null,
  opponent_name: null,
};

function mockAuthenticatedPlayer() {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: "player" }, error: null }),
    }),
  } as never);
}

describe("PlayerSessionDetailPage — notas da sessão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlayerAttendanceForSession).mockResolvedValue({ ok: true, data: null });
  });

  it("mostra as notas da sessão quando existem", async () => {
    mockAuthenticatedPlayer();
    vi.mocked(getSessionById).mockResolvedValue({
      ok: true,
      data: { ...BASE_SESSION, notes: "Exames médicos OBRIGATÓRIOS de início de época" },
    });

    const jsx = await PlayerSessionDetailPage({ params: Promise.resolve({ sessionId: SESSION_UUID }) });
    render(jsx);

    expect(screen.getByText("Notas")).toBeInTheDocument();
    expect(
      screen.getByText("Exames médicos OBRIGATÓRIOS de início de época")
    ).toBeInTheDocument();
  });

  it("não mostra a secção de notas quando a sessão não tem notas", async () => {
    mockAuthenticatedPlayer();
    vi.mocked(getSessionById).mockResolvedValue({
      ok: true,
      data: { ...BASE_SESSION, notes: null },
    });

    const jsx = await PlayerSessionDetailPage({ params: Promise.resolve({ sessionId: SESSION_UUID }) });
    render(jsx);

    expect(screen.queryByText("Notas")).not.toBeInTheDocument();
  });
});
