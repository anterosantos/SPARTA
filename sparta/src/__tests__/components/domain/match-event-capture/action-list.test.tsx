import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ActionList } from "@/components/domain/match-event-capture/action-list";
import { useMatchSession } from "@/lib/stores/match-session";

describe("<ActionList>", () => {
  beforeEach(() => {
    useMatchSession.setState({ selectedPlayer: null, selectedAction: null, lastActionPolarity: null });
  });

  // Sprint 1.5: ActionList agora tem 8 ações standard + 5 eventos especiais = 13
  it("renderiza 13 botões de ação (8 standard + 5 eventos especiais)", () => {
    render(<ActionList />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(13);
  });

  it("inclui label 'Perda de bola'", () => {
    render(<ActionList />);
    expect(screen.getByRole("button", { name: "Perda de bola" })).toBeInTheDocument();
  });

  it("inclui label 'Passe completado'", () => {
    render(<ActionList />);
    expect(screen.getByRole("button", { name: "Passe completado" })).toBeInTheDocument();
  });

  it("inclui novos tipos Sprint 1.5 — Golo, Cartão, Canto", () => {
    render(<ActionList />);
    expect(screen.getByRole("button", { name: "Golo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cartão" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Canto" })).toBeInTheDocument();
  });

  it("define selectedAction ao clicar numa ação", () => {
    render(<ActionList />);
    fireEvent.click(screen.getByRole("button", { name: "Perda de bola" }));
    expect(useMatchSession.getState().selectedAction).toBe("ball_loss");
  });

  it("define selectedAction 'ball_recovery' ao clicar", () => {
    render(<ActionList />);
    fireEvent.click(screen.getByRole("button", { name: "Recuperação" }));
    expect(useMatchSession.getState().selectedAction).toBe("ball_recovery");
  });

  it("renderiza num grid de 2 colunas", () => {
    const { container } = render(<ActionList />);
    const grid = container.querySelector(".grid-cols-2");
    expect(grid).toBeInTheDocument();
  });

  it("renderiza todas as ações standard na lista", () => {
    render(<ActionList />);
    const labels = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(labels).toContain("Perda de bola");
    expect(labels).toContain("Recuperação");
    expect(labels).toContain("Remate total");
    expect(labels).toContain("Remate enquadrado");
    expect(labels).toContain("Passe completado");
    expect(labels).toContain("Pressão defensiva");
    expect(labels).toContain("Ação def. com sucesso");
    expect(labels).toContain("Ação of. com sucesso");
  });
});
