/**
 * field-formation.test.tsx — Testes para FieldFormation (vista por posição primária)
 *
 * Cobre:
 * - Todos os chips de jogador renderizados com aria-label correcto
 * - Clique num chip chama onSelectPlayer
 * - SVG campo tem role="img" e aria-label correcto
 * - Sem selector de formação tática
 * - Empty state quando players=[]
 * - layoutPlayers: DD à direita, DE à esquerda, spread horizontal
 * - spreadHorizontal: distribuição simétrica
 * - Acessibilidade axe-core
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { FieldFormation, layoutPlayers, spreadHorizontal } from "@/components/domain/readiness/field-formation";
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
  makePlayer({ player_id: "p-gr-1",  jerseyNum: 1,  playerName: "Rui Patrício",  primaryPosition: "GR"  }),
  makePlayer({ player_id: "p-dc-1",  jerseyNum: 4,  playerName: "Pepe Silva",     primaryPosition: "DC"  }),
  makePlayer({ player_id: "p-dc-2",  jerseyNum: 5,  playerName: "Ruben Dias",     primaryPosition: "DC"  }),
  makePlayer({ player_id: "p-dd-1",  jerseyNum: 2,  playerName: "Nélson Semedo",  primaryPosition: "DD"  }),
  makePlayer({ player_id: "p-de-1",  jerseyNum: 3,  playerName: "Raphaël Guerr",  primaryPosition: "DE"  }),
  makePlayer({ player_id: "p-mdc-1", jerseyNum: 14, playerName: "Renato Sanches", primaryPosition: "MDC" }),
  makePlayer({ player_id: "p-mc-1",  jerseyNum: 8,  playerName: "Moutinho João",  primaryPosition: "MC"  }),
  makePlayer({ player_id: "p-mc-2",  jerseyNum: 16, playerName: "William Costa",  primaryPosition: "MC"  }),
  makePlayer({ player_id: "p-exd-1", jerseyNum: 7,  playerName: "Ronaldo CR7",    primaryPosition: "EXD" }),
  makePlayer({ player_id: "p-exe-1", jerseyNum: 17, playerName: "Rafa Silva",     primaryPosition: "EXE" }),
  makePlayer({ player_id: "p-sc-1",  jerseyNum: 9,  playerName: "André Silva",    primaryPosition: "SC"  }),
];

// ── Unit tests: spreadHorizontal ──────────────────────────────────────────────

describe("spreadHorizontal", () => {
  it("returns baseXPct unchanged for count=1", () => {
    expect(spreadHorizontal(1, 50, 12)).toEqual([50]);
  });

  it("returns symmetric values for count=2", () => {
    const result = spreadHorizontal(2, 50, 10);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(40);
    expect(result[1]).toBe(60);
  });

  it("returns 3 distinct ordered values for count=3", () => {
    const result = spreadHorizontal(3, 50, 12);
    expect(result.length).toBe(3);
    expect(result[0]).toBeLessThan(result[1]!);
    expect(result[1]).toBeLessThan(result[2]!);
  });

  it("centre value equals baseXPct for odd count", () => {
    const result = spreadHorizontal(3, 50, 10);
    expect(result[1]).toBe(50);
  });
});

// ── Unit tests: layoutPlayers ─────────────────────────────────────────────────

describe("layoutPlayers", () => {
  it("DD appears to the right of centre (xPct > 50)", () => {
    const dd = makePlayer({ player_id: "p-dd", primaryPosition: "DD" });
    const placed = layoutPlayers([dd]);
    expect(placed[0]?.xPct).toBeGreaterThan(50);
  });

  it("DE appears to the left of centre (xPct < 50)", () => {
    const de = makePlayer({ player_id: "p-de", primaryPosition: "DE" });
    const placed = layoutPlayers([de]);
    expect(placed[0]?.xPct).toBeLessThan(50);
  });

  it("GR appears lower than MED (yPct > MED yPct)", () => {
    const gr  = makePlayer({ player_id: "p-gr",  primaryPosition: "GR" });
    const med = makePlayer({ player_id: "p-med", primaryPosition: "MC" });
    const placed = layoutPlayers([gr, med]);
    const grY  = placed.find(p => p.player.player_id === "p-gr")?.yPct ?? 0;
    const medY = placed.find(p => p.player.player_id === "p-med")?.yPct ?? 0;
    expect(grY).toBeGreaterThan(medY);
  });

  it("multiple DC players are spread horizontally at different xPct values", () => {
    const dc1 = makePlayer({ player_id: "p-dc-1", primaryPosition: "DC" });
    const dc2 = makePlayer({ player_id: "p-dc-2", primaryPosition: "DC" });
    const dc3 = makePlayer({ player_id: "p-dc-3", primaryPosition: "DC" });
    const placed = layoutPlayers([dc1, dc2, dc3]);
    const xValues = placed.map(p => p.xPct);
    expect(new Set(xValues).size).toBe(3);
  });

  it("xPct is clamped between 8 and 92", () => {
    const players = Array.from({ length: 10 }, (_, i) =>
      makePlayer({ player_id: `p-${i}`, primaryPosition: "DC" })
    );
    const placed = layoutPlayers(players);
    for (const { xPct } of placed) {
      expect(xPct).toBeGreaterThanOrEqual(8);
      expect(xPct).toBeLessThanOrEqual(92);
    }
  });

  it("player with unknown position does not crash and uses default coords", () => {
    const unknown = makePlayer({ player_id: "p-unknown", primaryPosition: "XYZ" });
    const placed = layoutPlayers([unknown]);
    expect(placed.length).toBe(1);
    expect(placed[0]?.xPct).toBe(50);
    expect(placed[0]?.yPct).toBe(44);
  });

  it("player with whitespace-only position is handled", () => {
    const whitespace = makePlayer({ player_id: "p-ws", primaryPosition: "   " });
    const placed = layoutPlayers([whitespace]);
    expect(placed.length).toBe(1);
    expect(placed[0]?.xPct).toBe(50);
  });
});

// ── Component tests: FieldFormation ───────────────────────────────────────────

describe("FieldFormation", () => {
  it("renders all player chips", () => {
    render(<FieldFormation players={fixturePlayers} onSelectPlayer={vi.fn()} />);
    const chips = screen.getAllByRole("button", { name: /Estado:/ });
    expect(chips.length).toBe(fixturePlayers.length);
  });

  it("each chip aria-label includes state, name, position, and ACWR", () => {
    render(<FieldFormation players={fixturePlayers} onSelectPlayer={vi.fn()} />);
    const grChip = screen.getByRole("button", { name: /Rui Patrício/ });
    expect(grChip).toHaveAttribute("aria-label", expect.stringContaining("Estado: Pronto"));
    expect(grChip).toHaveAttribute("aria-label", expect.stringContaining("Rui Patrício"));
    expect(grChip).toHaveAttribute("aria-label", expect.stringContaining("GR"));
    expect(grChip).toHaveAttribute("aria-label", expect.stringContaining("ACWR"));
  });

  it("calls onSelectPlayer when a chip is clicked", () => {
    const onSelectPlayer = vi.fn();
    render(<FieldFormation players={fixturePlayers} onSelectPlayer={onSelectPlayer} />);
    fireEvent.click(screen.getByRole("button", { name: /Rui Patrício/ }));
    expect(onSelectPlayer).toHaveBeenCalledTimes(1);
    expect(onSelectPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ player_id: "p-gr-1" })
    );
  });

  it("SVG field has correct aria-label for position-based view", () => {
    const { container } = render(<FieldFormation players={fixturePlayers} onSelectPlayer={vi.fn()} />);
    const svg = container.querySelector('svg[aria-label="Campo de futebol — jogadores por posição"]');
    expect(svg).toBeInTheDocument();
  });

  it("does not render formation selector buttons", () => {
    render(<FieldFormation players={fixturePlayers} onSelectPlayer={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /4-3-3/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /4-4-2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /3-5-2/ })).not.toBeInTheDocument();
  });

  it("renders empty state message when players=[]", () => {
    render(<FieldFormation players={[]} onSelectPlayer={vi.fn()} />);
    expect(screen.getByText("Sem jogadores no plantel")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /Estado:/ })).toHaveLength(0);
  });

  it("shows jersey number inside chip, or ? when null", () => {
    const noJersey = makePlayer({ player_id: "p-no-jersey", jerseyNum: null as unknown as number, primaryPosition: "GR" });
    render(<FieldFormation players={[noJersey]} onSelectPlayer={vi.fn()} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("has zero axe violations with full squad", async () => {
    const { container } = render(
      <FieldFormation players={fixturePlayers} onSelectPlayer={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
