import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ActionList } from "@/components/domain/match-event-capture/action-list";
import { useMatchSession } from "@/lib/stores/match-session";

describe("<ActionList>", () => {
  beforeEach(() => {
    useMatchSession.setState({ selectedPlayer: null, selectedAction: null, lastActionPolarity: null });
  });

  // ActionList é agora o primeiro ecrã (fluxo Evento→Jogador→Zona) — 4 ações
  // standard + 5 eventos especiais, sem botão de trocar jogador (não há ainda
  // jogador seleccionado nesta fase). Passe completado, pressão defensiva e
  // ações def./of. com sucesso foram retiradas do grid (pouco usadas), mas
  // continuam válidas no schema para dados históricos.
  it("renderiza 9 botões de ação (4 standard + 5 eventos especiais)", () => {
    render(<ActionList />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(9);
  });

  it("inclui label 'Perda de bola'", () => {
    render(<ActionList />);
    expect(screen.getByRole("button", { name: "Perda de bola" })).toBeInTheDocument();
  });

  it("não inclui 'Passe completado', 'Pressão defensiva' nem as ações com sucesso (retiradas do grid)", () => {
    render(<ActionList />);
    expect(screen.queryByRole("button", { name: "Passe completado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pressão defensiva" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ação def. com sucesso" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ação of. com sucesso" })).not.toBeInTheDocument();
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
    expect(labels).toContain("Remate desenquadrado");
    expect(labels).toContain("Remate enquadrado");
  });
});
