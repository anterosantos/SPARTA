import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TeamAggregateData } from "@/lib/actions/team-aggregate";

vi.mock("@/lib/actions/team-aggregate", () => ({
  getTeamAcwrChart: vi.fn(),
}));

// Mock recharts — ResizeObserver/SVG unavailable in jsdom (same pattern as FatigueChart.test.tsx)
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  Line: ({ name }: { name?: string }) => <div data-testid="chart-line">{name}</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceArea: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

vi.mock("@/components/domain/TeamWeightFormation", () => ({
  TeamWeightFormation: () => <div data-testid="team-weight-formation" />,
}));

vi.mock("@/components/domain/TeamHeightFormation", () => ({
  TeamHeightFormation: () => <div data-testid="team-height-formation" />,
}));

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import { TeamAggregateDashboard } from "@/components/domain/TeamAggregateDashboard";
import { getTeamAcwrChart } from "@/lib/actions/team-aggregate";

const mockGetTeamAcwrChart = getTeamAcwrChart as ReturnType<typeof vi.fn>;

function makeData(overrides: Partial<TeamAggregateData> = {}): TeamAggregateData {
  return {
    weeklyFatigue: [],
    weeklyAttendance: [],
    topLoaded: [],
    topFatigued: [],
    eventsPerMatch: [],
    squadFormation: [],
    teamAcwr: { points: [], series: [] },
    currentSeason: { id: "season-1", name: "2026/27" },
    totalActivePlayers: 0,
    userRole: "coach",
    ...overrides,
  };
}

describe("<TeamAggregateDashboard> — ACWR da equipa", () => {
  beforeEach(() => {
    mockGetTeamAcwrChart.mockReset();
  });

  it("mostra estado vazio quando não há série de ACWR", () => {
    render(<TeamAggregateDashboard data={makeData()} />);
    expect(screen.getByText("Sem dados de ACWR")).toBeInTheDocument();
  });

  it("mostra a banda segura ACWR (0.8–1.3) mesmo sem série de dados", () => {
    render(<TeamAggregateDashboard data={makeData()} />);
    expect(screen.getByText("Banda segura ACWR: 0.8–1.3")).toBeInTheDocument();
  });

  it("renderiza uma linha por jogador quando há série de ACWR", () => {
    const data = makeData({
      teamAcwr: {
        points: [
          { weekLabel: "Sem 1", weekStart: "2026-08-01T00:00:00Z", p1: 0.9, p2: 1.1 },
          { weekLabel: "Sem 2", weekStart: "2026-08-08T00:00:00Z", p1: 1.0, p2: null },
        ],
        series: [
          { playerId: "p1", playerName: "João Silva", ageGroup: "senior" },
          { playerId: "p2", playerName: "Ana Costa", ageGroup: "u19" },
        ],
      },
    });

    render(<TeamAggregateDashboard data={data} />);

    expect(screen.queryByText("Sem dados de ACWR")).not.toBeInTheDocument();
    const lines = screen.getAllByTestId("chart-line");
    expect(lines.map((l) => l.textContent)).toEqual(["João Silva", "Ana Costa"]);
  });

  const dataWithSeries = makeData({
    teamAcwr: {
      points: [{ weekLabel: "Sem 4", weekStart: "2026-08-08T00:00:00Z", p1: 1.0, p2: 1.1 }],
      series: [
        { playerId: "p1", playerName: "João Silva", ageGroup: "senior" },
        { playerId: "p2", playerName: "Ana Costa", ageGroup: "u19" },
      ],
    },
  });

  it("renderiza o toggle de intervalo com 'Último mês' seleccionado por omissão", () => {
    render(<TeamAggregateDashboard data={dataWithSeries} />);
    expect(screen.getByRole("button", { name: "Últimos 7 dias" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Último mês" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Época toda" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("trocar para 'Últimos 7 dias' chama getTeamAcwrChart('7d') e actualiza o gráfico", async () => {
    mockGetTeamAcwrChart.mockResolvedValue({
      ok: true,
      data: {
        points: [{ weekLabel: "29/08", weekStart: "2026-08-29T00:00:00Z", p1: 0.7 }],
        series: [{ playerId: "p1", playerName: "João Silva", ageGroup: "senior" }],
      },
    });

    render(<TeamAggregateDashboard data={dataWithSeries} />);
    fireEvent.click(screen.getByRole("button", { name: "Últimos 7 dias" }));

    expect(mockGetTeamAcwrChart).toHaveBeenCalledWith("7d");

    await waitFor(() => {
      const lines = screen.getAllByTestId("chart-line");
      expect(lines.map((l) => l.textContent)).toEqual(["João Silva"]);
    });
  });

  it("mostra erro quando getTeamAcwrChart falha ao trocar de intervalo", async () => {
    mockGetTeamAcwrChart.mockResolvedValue({
      ok: false,
      error: { code: "db_error", message: "Erro ao carregar ACWR" },
    });

    render(<TeamAggregateDashboard data={dataWithSeries} />);
    fireEvent.click(screen.getByRole("button", { name: "Época toda" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Erro ao carregar ACWR");
    });
  });

  it("clicar na legenda de um jogador retira a linha do gráfico", () => {
    render(<TeamAggregateDashboard data={dataWithSeries} />);

    expect(screen.getAllByTestId("chart-line").map((l) => l.textContent)).toEqual([
      "João Silva",
      "Ana Costa",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Ocultar João Silva no gráfico" }));

    expect(screen.getAllByTestId("chart-line").map((l) => l.textContent)).toEqual(["Ana Costa"]);
    expect(screen.getByRole("button", { name: "Mostrar João Silva no gráfico" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("clicar de novo na legenda oculta mostra a linha outra vez", () => {
    render(<TeamAggregateDashboard data={dataWithSeries} />);

    fireEvent.click(screen.getByRole("button", { name: "Ocultar João Silva no gráfico" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar João Silva no gráfico" }));

    expect(screen.getAllByTestId("chart-line").map((l) => l.textContent)).toEqual([
      "João Silva",
      "Ana Costa",
    ]);
  });
});
