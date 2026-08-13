import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";
const CLUB_UUID = "650e8400-e29b-41d4-a716-446655440002";
const SEASON_UUID = "850e8400-e29b-41d4-a716-446655440004";
const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";

const FUTURE_AT = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const mockSession = {
  id: SESSION_UUID,
  club_id: CLUB_UUID,
  season_id: SEASON_UUID,
  type: "training" as const,
  scheduled_at: FUTURE_AT,
  duration_min: 90,
  location: "Campo Municipal",
  status: "scheduled" as const,
  notes: null,
  created_by: USER_UUID,
  created_at: "2026-05-19T00:00:00Z",
  concentration_time: null,
  opponent_name: null,
};

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/actions/sessions", () => ({
  getSessionsForClub: vi.fn(),
}));

vi.mock("@/lib/actions/fatigue", () => ({
  getSessionFatigueStatus: vi
    .fn()
    .mockResolvedValue({ ok: true, data: { pre: false, post: false } }),
}));

vi.mock("@/lib/actions/player-attendance", () => ({
  getPlayerAttendanceForSession: vi.fn().mockResolvedValue({ ok: true, data: null }),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { getSessionFatigueStatus } from "@/lib/actions/fatigue";
import { getPlayerAttendanceForSession } from "@/lib/actions/player-attendance";
import HojePage from "@/app/(player)/hoje/page";

function makeSupabaseMock(role = "player") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role, club_id: CLUB_UUID },
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
}

describe("HojePage — vista do jogador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza próxima sessão quando existe", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession],
    });

    const jsx = await HojePage();
    render(jsx);

    expect(screen.getByText("Próximos 7 dias")).toBeInTheDocument();
    expect(screen.getByText(/campo municipal/i)).toBeInTheDocument();
  });

  it("renderiza todas as sessões dos próximos 7 dias, não só a mais próxima", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    const secondSession = {
      ...mockSession,
      id: "550e8400-e29b-41d4-a716-446655440002",
      location: "Campo Secundário",
      scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession, secondSession],
    });

    const jsx = await HojePage();
    render(jsx);

    expect(screen.getByText(/campo municipal/i)).toBeInTheDocument();
    expect(screen.getByText(/campo secundário/i)).toBeInTheDocument();
  });

  it("sessão do tipo palestra aparece na lista mas sem link para o questionário", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    const lectureSession = {
      ...mockSession,
      id: "550e8400-e29b-41d4-a716-446655440003",
      type: "lecture" as const,
      location: "Auditório",
    };
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [lectureSession],
    });

    const jsx = await HojePage();
    render(jsx);

    const link = screen.getByRole("link", { name: /Palestra/i });
    expect(link).toHaveAttribute("href", `/agenda/${lectureSession.id}`);
    expect(getSessionFatigueStatus).not.toHaveBeenCalled();
  });

  it("renderiza EmptyState quando não há sessão nos próximos 7 dias", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({ ok: true, data: [] });

    const jsx = await HojePage();
    render(jsx);

    expect(
      screen.getByText(/sem sessões nos próximos 7 dias/i)
    ).toBeInTheDocument();
  });

  it("chama getSessionsForClub com janela de 7 dias e status=scheduled", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({ ok: true, data: [] });

    await HojePage();

    expect(getSessionsForClub).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "scheduled",
        from: expect.any(String),
        to: expect.any(String),
      })
    );
  });

  it("renderiza EmptyState quando getSessionsForClub falha", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: false,
      error: { code: "unknown", message: "DB error" },
    });

    const jsx = await HojePage();
    render(jsx);

    expect(
      screen.getByText(/sem sessões nos próximos 7 dias/i)
    ).toBeInTheDocument();
  });

  it("esconde a sessão recente do questionário pós quando o jogador declarou ausência", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    const pastSession = {
      ...mockSession,
      id: "550e8400-e29b-41d4-a716-446655440009",
      scheduled_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: "completed" as const,
    };
    vi.mocked(getSessionsForClub)
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [pastSession] });
    vi.mocked(getPlayerAttendanceForSession).mockResolvedValue({
      ok: true,
      data: { status: "absent", note: null },
    });

    const jsx = await HojePage();
    render(jsx);

    expect(screen.queryByText("Sessão recente")).not.toBeInTheDocument();
    expect(screen.getByText("Tudo registado")).toBeInTheDocument();
  });

  it("mostra a sessão recente por responder quando o jogador não declarou ausência", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    const pastSession = {
      ...mockSession,
      id: "550e8400-e29b-41d4-a716-446655440009",
      scheduled_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: "completed" as const,
    };
    vi.mocked(getSessionsForClub)
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [pastSession] });
    vi.mocked(getPlayerAttendanceForSession).mockResolvedValue({ ok: true, data: null });

    const jsx = await HojePage();
    render(jsx);

    expect(screen.getByText("Sessão recente")).toBeInTheDocument();
  });
});
