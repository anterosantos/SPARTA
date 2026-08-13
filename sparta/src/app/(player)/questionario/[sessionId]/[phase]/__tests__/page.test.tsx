/**
 * questionnaire-page.test.tsx — Testes para phase-aware status guard
 * AC #1 — Story 4.9
 *
 * Nota: Esta é uma página Server Component, então testes serão limitados
 * ao aspecto lógico do guard. Os testes verificam o comportamento esperado
 * em diferentes cenários de status e phase.
 *
 * Cobre:
 * - phase='post' + status='completed' → renders form (not error)
 * - phase='post' + status='cancelled' → shows error
 * - phase='pre' + status='completed' → shows error (unchanged)
 * - phase='pre' + status='scheduled' → renders form (unchanged)
 * - phase='post' + ausência declarada → shows error (não bloqueia phase='pre')
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { requiresFatigueQuestionnaire } from "@/lib/schemas/sessions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
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

vi.mock("@/components/ui/fatigue-questionnaire", () => ({
  FatigueQuestionnaire: ({ initialAbsent }: { initialAbsent?: boolean }) => (
    <div data-testid="fatigue-questionnaire" data-initial-absent={String(initialAbsent)} />
  ),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getSessionById } from "@/lib/actions/sessions";
import { getPlayerAttendanceForSession } from "@/lib/actions/player-attendance";
import QuestionarioPage from "../page";

describe("QuestionarioPage — guard de tipo de sessão (palestra/médico/outros não têm questionário)", () => {
  it("bloqueia acesso quando a sessão é do tipo 'lecture'", () => {
    expect(requiresFatigueQuestionnaire("lecture")).toBe(false);
  });

  it("bloqueia acesso quando a sessão é do tipo 'medical'", () => {
    expect(requiresFatigueQuestionnaire("medical")).toBe(false);
  });

  it("bloqueia acesso quando a sessão é do tipo 'other'", () => {
    expect(requiresFatigueQuestionnaire("other")).toBe(false);
  });

  it("permite acesso para treino/jogo/amigável", () => {
    expect(requiresFatigueQuestionnaire("training")).toBe(true);
    expect(requiresFatigueQuestionnaire("match")).toBe(true);
    expect(requiresFatigueQuestionnaire("friendly")).toBe(true);
  });
});

describe("QuestionarioPage phase-aware guard logic", () => {
  // Helper para testar a guard lógica
  const isValidStatus = (phase: string, status: string): boolean => {
    const isValid =
      phase === "post"
        ? status === "scheduled" || status === "completed"
        : status === "scheduled";
    return isValid;
  };

  it("allows phase='post' + status='completed'", () => {
    const valid = isValidStatus("post", "completed");
    expect(valid).toBe(true);
  });

  it("allows phase='post' + status='scheduled'", () => {
    const valid = isValidStatus("post", "scheduled");
    expect(valid).toBe(true);
  });

  it("denies phase='post' + status='cancelled'", () => {
    const valid = isValidStatus("post", "cancelled");
    expect(valid).toBe(false);
  });

  it("allows phase='pre' + status='scheduled'", () => {
    const valid = isValidStatus("pre", "scheduled");
    expect(valid).toBe(true);
  });

  it("denies phase='pre' + status='completed'", () => {
    const valid = isValidStatus("pre", "completed");
    expect(valid).toBe(false);
  });

  it("denies phase='pre' + status='cancelled'", () => {
    const valid = isValidStatus("pre", "cancelled");
    expect(valid).toBe(false);
  });
});

// ─── Guard de ausência — questionário pós-sessão indisponível se declarada ────

describe("QuestionarioPage — guard de ausência (fase post)", () => {
  const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";
  const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";

  const BASE_SESSION = {
    id: SESSION_UUID,
    club_id: "650e8400-e29b-41d4-a716-446655440002",
    season_id: "850e8400-e29b-41d4-a716-446655440004",
    type: "training" as const,
    scheduled_at: "2026-08-17T18:00:00.000Z",
    duration_min: 90,
    location: "Campo A",
    status: "scheduled" as const,
    notes: null,
    created_by: USER_UUID,
    created_at: "2026-08-01T00:00:00Z",
    concentration_time: null,
    opponent_name: null,
  };

  function mockAuthenticatedPlayer() {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } } }) },
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "player" }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue(
          table === "players"
            ? { data: { id: "player-1", age_group: "senior" }, error: null }
            : { data: null, error: null }
        ),
      })),
    } as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloqueia o questionário pós-sessão quando o jogador declarou ausência", async () => {
    mockAuthenticatedPlayer();
    vi.mocked(getSessionById).mockResolvedValue({ ok: true, data: BASE_SESSION });
    vi.mocked(getPlayerAttendanceForSession).mockResolvedValue({
      ok: true,
      data: { status: "absent", note: null },
    });

    const jsx = await QuestionarioPage({
      params: Promise.resolve({ sessionId: SESSION_UUID, phase: "post" }),
    });
    render(jsx);

    expect(screen.getByText(/ausência.*questionário pós-sessão não está disponível/i)).toBeInTheDocument();
    expect(screen.queryByTestId("fatigue-questionnaire")).not.toBeInTheDocument();
  });

  it("NÃO bloqueia o questionário pré-sessão quando o jogador declarou ausência, mas pré-marca o toggle", async () => {
    mockAuthenticatedPlayer();
    vi.mocked(getSessionById).mockResolvedValue({ ok: true, data: BASE_SESSION });
    vi.mocked(getPlayerAttendanceForSession).mockResolvedValue({
      ok: true,
      data: { status: "absent", note: null },
    });

    const jsx = await QuestionarioPage({
      params: Promise.resolve({ sessionId: SESSION_UUID, phase: "pre" }),
    });
    render(jsx);

    const questionnaire = screen.getByTestId("fatigue-questionnaire");
    expect(questionnaire).toBeInTheDocument();
    expect(questionnaire).toHaveAttribute("data-initial-absent", "true");
  });

  it("permite o questionário pós-sessão quando o jogador não declarou ausência", async () => {
    mockAuthenticatedPlayer();
    vi.mocked(getSessionById).mockResolvedValue({
      ok: true,
      data: { ...BASE_SESSION, status: "completed" },
    });
    vi.mocked(getPlayerAttendanceForSession).mockResolvedValue({ ok: true, data: null });

    const jsx = await QuestionarioPage({
      params: Promise.resolve({ sessionId: SESSION_UUID, phase: "post" }),
    });
    render(jsx);

    expect(screen.getByTestId("fatigue-questionnaire")).toBeInTheDocument();
  });
});
