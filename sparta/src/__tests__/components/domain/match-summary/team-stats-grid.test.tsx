import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TeamStatsGrid } from "@/components/domain/match-summary/team-stats-grid";
import type { MatchSummaryActionTotal } from "@/lib/actions/match-summary";

const stats: MatchSummaryActionTotal[] = [
  {
    action: "corner",
    label: "Canto",
    count: 2,
    positive: false,
    events: [
      { playerName: "Jogador A", jerseyNum: 7, zone: "att_left" },
      { playerName: null, jerseyNum: null, zone: "att_right" },
    ],
  },
  {
    action: "pass_completed",
    label: "Passe completado",
    count: 0,
    positive: true,
    events: [],
  },
];

describe("<TeamStatsGrid>", () => {
  it("renderiza uma tile por estatística com a contagem e o label", () => {
    render(<TeamStatsGrid stats={stats} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Canto")).toBeInTheDocument();
    expect(screen.getByText("Passe completado")).toBeInTheDocument();
  });

  it("clicar numa estatística com eventos abre o detalhe com jogador e zona", () => {
    render(<TeamStatsGrid stats={stats} />);
    fireEvent.click(screen.getByRole("button", { name: /Canto: 2/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Jogador A")).toBeInTheDocument();
    expect(screen.getByText("Adversário")).toBeInTheDocument();
    expect(screen.getByText("Ataque esquerda")).toBeInTheDocument();
    expect(screen.getByText("Ataque direita")).toBeInTheDocument();
  });

  it("estatística com count=0 fica desabilitada e não abre detalhe", () => {
    render(<TeamStatsGrid stats={stats} />);
    const button = screen.getByRole("button", { name: /Passe completado: 0/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("botão fechar fecha o detalhe", () => {
    render(<TeamStatsGrid stats={stats} />);
    fireEvent.click(screen.getByRole("button", { name: /Canto: 2/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
