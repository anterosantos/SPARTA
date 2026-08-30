import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EstatisticasTab } from "./EstatisticasTab";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/actions/player-profile", () => ({
  getPlayerStatisticsTabData: vi.fn(),
}));

vi.mock("@/lib/actions/seasons", () => ({
  getCurrentSeason: vi.fn().mockResolvedValue({ ok: true, data: { id: "season-1" } }),
}));

import { getPlayerStatisticsTabData } from "@/lib/actions/player-profile";

const mockGetStats = getPlayerStatisticsTabData as ReturnType<typeof vi.fn>;

const sampleRow = {
  session_id: "sess-1",
  date: "2026-08-30T15:00:00Z",
  session_type: "match",
  minutes_played: 90,
  losses: 1,
  recoveries: 2,
  shots: 3,
  shots_on_target: 1,
  passes: 0,
  defensive_pressures: 0,
  offensive_actions: 0,
  defensive_actions: 0,
  zones: { att_center: 1 },
};

const sampleData = {
  rows: [sampleRow],
  totals: {
    minutes: 90,
    losses: 1,
    recoveries: 2,
    shots: 3,
    shots_on_target: 1,
    passes: 0,
    defensive_pressures: 0,
    offensive_actions: 0,
    defensive_actions: 0,
  },
  zoneHeatmap: { att_center: 1 },
};

describe("<EstatisticasTab> — filtro por tipo de sessão", () => {
  beforeEach(() => {
    mockGetStats.mockReset();
    mockGetStats.mockResolvedValue({ ok: true, data: sampleData });
  });

  it("renderiza o filtro com as 3 opções e 'Todos' seleccionado por omissão", async () => {
    render(<EstatisticasTab playerId="player-1" isCumulative={false} />);
    await waitFor(() => expect(mockGetStats).toHaveBeenCalled());

    const todos = screen.getByRole("button", { name: "Todos" });
    const jogos = screen.getByRole("button", { name: "Jogos" });
    const amigaveis = screen.getByRole("button", { name: "Amigáveis" });
    expect(todos).toHaveAttribute("aria-pressed", "true");
    expect(jogos).toHaveAttribute("aria-pressed", "false");
    expect(amigaveis).toHaveAttribute("aria-pressed", "false");
  });

  it("clicar em 'Jogos' chama getPlayerStatisticsTabData com sessionType='match'", async () => {
    render(<EstatisticasTab playerId="player-1" isCumulative={false} />);
    await waitFor(() => expect(mockGetStats).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Jogos" }));

    await waitFor(() => {
      expect(mockGetStats).toHaveBeenLastCalledWith("player-1", "season-1", "match");
    });
  });

  it("clicar em 'Amigáveis' chama getPlayerStatisticsTabData com sessionType='friendly'", async () => {
    render(<EstatisticasTab playerId="player-1" isCumulative={false} />);
    await waitFor(() => expect(mockGetStats).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Amigáveis" }));

    await waitFor(() => {
      expect(mockGetStats).toHaveBeenLastCalledWith("player-1", "season-1", "friendly");
    });
  });

  it("por omissão chama getPlayerStatisticsTabData com sessionType=null ('Todos')", async () => {
    render(<EstatisticasTab playerId="player-1" isCumulative={false} />);
    await waitFor(() => {
      expect(mockGetStats).toHaveBeenCalledWith("player-1", "season-1", null);
    });
  });
});
