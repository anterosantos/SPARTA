/**
 * readiness-panel-formation.test.tsx — Testes para ReadinessPanelFormation
 *
 * Vista por posição primária — mostra todos os jogadores no campo sem carregar lineup.
 * Cobre:
 * - Renderização imediata (sem fetch assíncrono)
 * - Todos os chips de jogador presentes
 * - Tap num chip abre DrillDownSheet
 * - Acessibilidade axe-core
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/components/domain/readiness/player-drill-down-sheet", () => ({
  PlayerDrillDownSheet: ({
    open,
    snapshot,
  }: {
    open: boolean;
    snapshot: { playerName?: string } | null;
  }) =>
    open ? (
      <div data-testid="drill-down-sheet">{snapshot?.playerName ?? "sheet"}</div>
    ) : null,
}));

vi.mock("recharts", () => ({
  LineChart: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ReadinessPanelFormation } from "@/components/domain/readiness/readiness-panel-formation";
import type { PlayerReadinessData } from "@/types/supabase";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const CLUB_UUID    = "650e8400-e29b-41d4-a716-446655440002";

function makePlayer(
  overrides: Partial<PlayerReadinessData> & { player_id: string; primaryPosition: string }
): PlayerReadinessData {
  return {
    session_id: SESSION_UUID,
    club_id: CLUB_UUID,
    state: "ready",
    acwr: 1.1,
    acwr_band_lo: 0.8,
    acwr_band_hi: 1.5,
    recent_fatigue_avg: 2.5,
    attendance_rate: 0.9,
    data_sufficient: true,
    derived_age_group: "senior",
    computed_at: "2026-05-27T00:00:00Z",
    playerName: "Jogador Teste",
    jerseyNum: 10,
    recentMusclePainZones: null,
    hasExamsThisWeek: null,
    declaredAbsent: false,
    absenceNote: null,
    ...overrides,
  };
}

const fixturePlayers: PlayerReadinessData[] = [
  makePlayer({ player_id: "player-gr-1",   jerseyNum: 1,  playerName: "Rui Patrício",  primaryPosition: "GR"  }),
  makePlayer({ player_id: "player-dc-1",   jerseyNum: 4,  playerName: "Pepe Silva",     primaryPosition: "DC"  }),
  makePlayer({ player_id: "player-dc-2",   jerseyNum: 5,  playerName: "Ruben Dias",     primaryPosition: "DC"  }),
  makePlayer({ player_id: "player-dd-1",   jerseyNum: 2,  playerName: "Nélson Semedo",  primaryPosition: "DD"  }),
  makePlayer({ player_id: "player-de-1",   jerseyNum: 3,  playerName: "Raphaël Guerr",  primaryPosition: "DE"  }),
  makePlayer({ player_id: "player-mdc-1",  jerseyNum: 14, playerName: "Renato Sanches", primaryPosition: "MDC" }),
  makePlayer({ player_id: "player-mc-1",   jerseyNum: 8,  playerName: "Moutinho João",  primaryPosition: "MC"  }),
  makePlayer({ player_id: "player-mc-2",   jerseyNum: 16, playerName: "William Costa",  primaryPosition: "MC"  }),
  makePlayer({ player_id: "player-exd-1",  jerseyNum: 7,  playerName: "Ronaldo CR7",    primaryPosition: "EXD" }),
  makePlayer({ player_id: "player-exe-1",  jerseyNum: 17, playerName: "Rafa Silva",     primaryPosition: "EXE" }),
  makePlayer({ player_id: "player-sc-1",   jerseyNum: 9,  playerName: "André Silva",    primaryPosition: "SC"  }),
  makePlayer({ player_id: "player-gr-2",   jerseyNum: 22, playerName: "Beto Reserva",   primaryPosition: "GR"  }),
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReadinessPanelFormation", () => {
  it("renders all players immediately without async loading", () => {
    render(<ReadinessPanelFormation players={fixturePlayers} />);
    const chips = screen.getAllByRole("button", { name: /Estado:/ });
    expect(chips.length).toBe(fixturePlayers.length);
  });

  it("renders the testid container", () => {
    render(<ReadinessPanelFormation players={fixturePlayers} />);
    expect(screen.getByTestId("readiness-panel-formation")).toBeInTheDocument();
  });

  it("shows all players including substitutes (no bench section)", () => {
    render(<ReadinessPanelFormation players={fixturePlayers} />);
    // Both GRs should be on the field, not in a separate bench section
    expect(screen.getByRole("button", { name: /Rui Patrício/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Beto Reserva/ })).toBeInTheDocument();
    expect(screen.queryByText(/Banco/i)).not.toBeInTheDocument();
  });

  it("clicking a player chip opens position popup", () => {
    render(<ReadinessPanelFormation players={fixturePlayers} />);
    const chips = screen.getAllByRole("button", { name: /Estado:/ });
    fireEvent.click(chips[0]!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("position popup lists all players of that position", () => {
    render(<ReadinessPanelFormation players={fixturePlayers} />);
    // GR has two players in fixture (Rui Patrício + Beto Reserva)
    fireEvent.click(screen.getByRole("button", { name: /Rui Patrício/ }));
    expect(screen.getByRole("button", { name: "Ver detalhe de Rui Patrício" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver detalhe de Beto Reserva" })).toBeInTheDocument();
  });

  it("clicking player in popup opens DrillDownSheet with correct snapshot", () => {
    render(<ReadinessPanelFormation players={fixturePlayers} />);
    fireEvent.click(screen.getByRole("button", { name: /Rui Patrício/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhe de Rui Patrício" }));
    expect(screen.getByTestId("drill-down-sheet")).toHaveTextContent("Rui Patrício");
  });

  it("renders empty state when players array is empty", () => {
    render(<ReadinessPanelFormation players={[]} />);
    expect(screen.getByText("Sem jogadores no plantel")).toBeInTheDocument();
  });

  it("has zero axe violations", async () => {
    const { container } = render(<ReadinessPanelFormation players={fixturePlayers} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has zero axe violations in empty state", async () => {
    const { container } = render(<ReadinessPanelFormation players={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
