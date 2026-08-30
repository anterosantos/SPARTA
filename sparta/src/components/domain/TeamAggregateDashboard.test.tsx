import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TeamAggregateData } from "@/lib/actions/team-aggregate";

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
  it("mostra estado vazio quando não há série de ACWR", () => {
    render(<TeamAggregateDashboard data={makeData()} />);
    expect(screen.getByText("Sem dados de ACWR")).toBeInTheDocument();
  });

  it("renderiza uma linha por jogador quando há série de ACWR", () => {
    const data = makeData({
      teamAcwr: {
        points: [
          { weekLabel: "Sem 1", weekStart: "2026-08-01T00:00:00Z", values: { p1: 0.9, p2: 1.1 } },
          { weekLabel: "Sem 2", weekStart: "2026-08-08T00:00:00Z", values: { p1: 1.0, p2: null } },
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
});
