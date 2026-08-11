/**
 * today-page-content.test.tsx — Testes para TodayPageContent com feedback de respostas
 * AC #4, AC #5 — Story 4.10
 *
 * Cobre:
 * - answeredMap[id]=true → card com indicador
 * - allDoneToday=true + upcomingSessions=[] → "Tudo registado" empty state
 * - Combinação: upcomingSessions + recentSession (Story 4.9) ambos visíveis
 * - Lista de várias sessões nos próximos 7 dias (não só a mais próxima)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// NotificationsRefreshButton usa useRouter — precisa de mock do App Router
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { TodayPageContent } from "@/components/app/today-page-content";
import type { Session } from "@/lib/schemas/sessions";

const mockSession: Session = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  club_id: "650e8400-e29b-41d4-a716-446655440002",
  season_id: "750e8400-e29b-41d4-a716-446655440003",
  type: "training",
  status: "scheduled",
  scheduled_at: "2026-05-25T10:00:00Z",
  location: "Campo Principal",
  duration_min: 90,
  notes: null,
  created_by: "950e8400-e29b-41d4-a716-446655440005",
  created_at: "2026-05-24T00:00:00Z",
  concentration_time: null,
  opponent_name: null,
};

const mockLectureSession: Session = {
  ...mockSession,
  id: "550e8400-e29b-41d4-a716-446655440077",
  type: "lecture",
  scheduled_at: "2026-05-26T10:00:00Z",
};

const mockRecentSession: Session = {
  ...mockSession,
  id: "550e8400-e29b-41d4-a716-446655440099",
  scheduled_at: "2026-05-24T10:00:00Z",
  status: "completed",
};

describe("TodayPageContent with answered state (Story 4.10)", () => {
  it("shows answered indicator when answeredMap[id]=true", () => {
    render(
      <TodayPageContent
        upcomingSessions={[mockSession]}
        answeredMap={{ [mockSession.id]: true }}
        userRole="player"
      />
    );

    expect(screen.getByText("Respondido")).toBeInTheDocument();
  });

  it("shows empty state 'Tudo registado' when allDoneToday=true and no upcoming sessions", () => {
    render(
      <TodayPageContent
        upcomingSessions={[]}
        allDoneToday={true}
        userRole="player"
      />
    );

    expect(screen.getByText("Tudo registado")).toBeInTheDocument();
    expect(
      screen.getByText("Questionários desta sessão concluídos.")
    ).toBeInTheDocument();
  });

  it("shows both upcoming sessions and recentSession when both exist", () => {
    render(
      <TodayPageContent
        upcomingSessions={[mockSession]}
        recentSession={mockRecentSession}
        userRole="player"
      />
    );

    expect(screen.getByText("Próximos 7 dias")).toBeInTheDocument();
    expect(screen.getByText("Sessão recente")).toBeInTheDocument();
  });

  it("shows 'Sem sessões' empty state when no sessions and not allDoneToday", () => {
    render(
      <TodayPageContent
        upcomingSessions={[]}
        recentSession={null}
        allDoneToday={false}
        userRole="player"
      />
    );

    expect(
      screen.getByText("Sem sessões nos próximos 7 dias")
    ).toBeInTheDocument();
  });

  it("shows Tudo registado when allDoneToday=true and no recentSession shown (post already answered)", () => {
    // Quando allDoneToday=true, recentSession é null porque post foi respondido (lógica do /hoje)
    render(
      <TodayPageContent
        upcomingSessions={[]}
        recentSession={null}
        allDoneToday={true}
        userRole="player"
      />
    );

    expect(screen.getByText("Tudo registado")).toBeInTheDocument();
    expect(screen.queryByText("Sessão recente")).not.toBeInTheDocument();
  });

  it("passes answered prop to SessionCard for each upcoming session", () => {
    render(
      <TodayPageContent
        upcomingSessions={[mockSession]}
        answeredMap={{ [mockSession.id]: true }}
        userRole="player"
      />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/hoje");
  });

  it("mostra todas as sessões dos próximos 7 dias, não só a mais próxima", () => {
    const secondSession: Session = {
      ...mockSession,
      id: "550e8400-e29b-41d4-a716-446655440002",
      scheduled_at: "2026-05-27T10:00:00Z",
    };

    render(
      <TodayPageContent
        upcomingSessions={[mockSession, secondSession]}
        userRole="player"
      />
    );

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("sessão do tipo palestra não tem indicador de resposta nem link para questionário", () => {
    render(
      <TodayPageContent
        upcomingSessions={[mockLectureSession]}
        answeredMap={{ [mockLectureSession.id]: true }}
        userRole="player"
      />
    );

    expect(screen.queryByText("Respondido")).not.toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/agenda/${mockLectureSession.id}`);
  });
});
