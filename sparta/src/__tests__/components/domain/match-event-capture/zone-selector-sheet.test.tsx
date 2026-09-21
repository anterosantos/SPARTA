import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZoneSelectorSheet } from "@/components/domain/match-event-capture/zone-selector-sheet";
import { useMatchSession } from "@/lib/stores/match-session";

vi.mock("@/lib/actions/events", () => ({
  submitMatchEvent: vi.fn(),
}));

vi.mock("@/lib/outbox/enqueue", () => ({
  enqueueMutation: vi.fn(),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => ({ isOnline: true }),
}));

vi.mock("@/lib/uuid", () => ({
  newId: () => "test-uuid-v7",
}));

const { submitMatchEvent } = await import("@/lib/actions/events");

const mockPlayer = {
  id: "lineup-1",
  session_id: "session-1",
  player_id: "player-uuid-1",
  name: "João Silva",
  jersey_number: 7,
  position: "Avançado",
  age_group: "Senior",
  processing_restricted: false,
  role: "starter" as const,
};

describe("<ZoneSelectorSheet>", () => {
  beforeEach(() => {
    useMatchSession.setState({
      selectedPlayer: null,
      selectedAction: null,
      isOpponentEvent: false,
      lastActionPolarity: null,
    });
    vi.mocked(submitMatchEvent).mockResolvedValue({ ok: true, data: { id: "test-uuid-v7" } });
  });

  it("não renderiza quando nenhuma ação selecionada", () => {
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza quando player e action estão selecionados", () => {
    useMatchSession.setState({ selectedPlayer: mockPlayer, selectedAction: "ball_loss" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renderiza 24 células de zona", () => {
    useMatchSession.setState({ selectedPlayer: mockPlayer, selectedAction: "ball_loss" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);
    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(24);
  });

  it("chama submitMatchEvent com payload correto ao clicar numa zona", async () => {
    useMatchSession.setState({ selectedPlayer: mockPlayer, selectedAction: "ball_loss" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);

    fireEvent.click(screen.getByRole("gridcell", { name: "Ataque linha de fundo esquerda" }));

    await waitFor(() => {
      expect(submitMatchEvent).toHaveBeenCalledWith({
        id: "test-uuid-v7",
        action: "ball_loss",
        zone: "att_end_left",
        player_id: "player-uuid-1",
        session_id: "session-1",
        occurred_at: expect.any(String),
        captured_via: "online",
        context: null,
      });
    });
  });

  it("limpa selectedPlayer mas mantém selectedAction após submit com sucesso (sticky action)", async () => {
    useMatchSession.setState({ selectedPlayer: mockPlayer, selectedAction: "ball_recovery" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);

    fireEvent.click(screen.getByRole("gridcell", { name: "Meio campo ofensivo esquerda" }));

    await waitFor(() => {
      const state = useMatchSession.getState();
      expect(state.selectedPlayer).toBeNull();
      expect(state.selectedAction).toBe("ball_recovery");
    });
  });

  it("renderiza quando isOpponentEvent e action estão selecionados (sem jogador)", () => {
    useMatchSession.setState({ selectedPlayer: null, isOpponentEvent: true, selectedAction: "corner" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("chama submitMatchEvent com player_id null para evento do adversário", async () => {
    useMatchSession.setState({ selectedPlayer: null, isOpponentEvent: true, selectedAction: "corner" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);

    fireEvent.click(screen.getByRole("gridcell", { name: "Ataque linha de fundo esquerda" }));

    await waitFor(() => {
      expect(submitMatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ player_id: null, action: "corner", zone: "att_end_left" })
      );
    });
  });

  it("limpa isOpponentEvent após submit de evento do adversário com sucesso", async () => {
    useMatchSession.setState({ selectedPlayer: null, isOpponentEvent: true, selectedAction: "corner" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);

    fireEvent.click(screen.getByRole("gridcell", { name: "Ataque linha de fundo esquerda" }));

    await waitFor(() => {
      const state = useMatchSession.getState();
      expect(state.isOpponentEvent).toBe(false);
      expect(state.selectedAction).toBe("corner");
    });
  });

  it("define lastActionPolarity como 'negative' para ball_loss", async () => {
    useMatchSession.setState({ selectedPlayer: mockPlayer, selectedAction: "ball_loss" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);

    fireEvent.click(screen.getByRole("gridcell", { name: "Ataque linha de fundo esquerda" }));

    await waitFor(() => {
      expect(useMatchSession.getState().lastActionPolarity).toBe("negative");
    });
  });

  it("define lastActionPolarity como 'positive' para pass_completed", async () => {
    useMatchSession.setState({ selectedPlayer: mockPlayer, selectedAction: "pass_completed" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);

    fireEvent.click(screen.getByRole("gridcell", { name: "Ataque entrada área esquerda" }));

    await waitFor(() => {
      expect(useMatchSession.getState().lastActionPolarity).toBe("positive");
    });
  });

  it("mostra mensagem de erro e enfileira no outbox quando submitMatchEvent falha", async () => {
    vi.mocked(submitMatchEvent).mockResolvedValue({
      ok: false,
      error: { code: "unknown", message: "Erro de servidor" },
    });
    const { enqueueMutation } = await import("@/lib/outbox/enqueue");

    useMatchSession.setState({ selectedPlayer: mockPlayer, selectedAction: "ball_loss" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);

    fireEvent.click(screen.getByRole("gridcell", { name: "Ataque linha de fundo esquerda" }));

    await waitFor(() => {
      expect(screen.getByText(/evento guardado para sincronização/i)).toBeInTheDocument();
      expect(enqueueMutation).toHaveBeenCalledWith(
        "match-event.submit",
        expect.objectContaining({ captured_via: "offline-drain" })
      );
    });
  });

  it("tem role='dialog' e aria-modal='true'", () => {
    useMatchSession.setState({ selectedPlayer: mockPlayer, selectedAction: "ball_loss" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("linhas de destaque: divisória branca, caixa verde de ataque e caixa vermelha de perigo", () => {
    useMatchSession.setState({ selectedPlayer: mockPlayer, selectedAction: "ball_loss" });
    render(<ZoneSelectorSheet sessionId="session-1" scheduledAt="2026-05-30T18:00:00.000Z" durationMin={90} />);

    const cellByLabel = (name: string) => screen.getByRole("gridcell", { name });

    // Divisória branca entre "Meio campo ofensivo" e "Meio campo defensivo"
    expect(cellByLabel("Meio campo defensivo esquerda").style.borderTopColor).toBe("rgb(255, 255, 255)");
    expect(cellByLabel("Meio campo defensivo direita").style.borderTopColor).toBe("rgb(255, 255, 255)");
    // Linha acima (meio campo ofensivo) não tem destaque
    expect(cellByLabel("Meio campo ofensivo esquerda").style.borderBottomColor).toBe("");

    // Caixa verde — bloco central de ataque (2×2)
    expect(cellByLabel("Ataque linha de fundo centro esquerda").style.borderTopColor).toBe("rgb(34, 197, 94)");
    expect(cellByLabel("Ataque entrada área centro direita").style.borderRightColor).toBe("rgb(34, 197, 94)");
    // Cantos fora da caixa não têm destaque
    expect(cellByLabel("Ataque linha de fundo esquerda").style.borderTopColor).toBe("");

    // Caixa vermelha — zona de perigo perto da própria baliza
    expect(cellByLabel("Defesa linha de fundo esquerda").style.borderLeftColor).toBe("rgb(239, 68, 68)");
    expect(cellByLabel("Defesa linha de fundo direita").style.borderRightColor).toBe("rgb(239, 68, 68)");
    expect(cellByLabel("Defesa entrada área centro esquerda").style.borderTopColor).toBe("rgb(239, 68, 68)");
    // Os cantos da linha "entrada área" (fora da caixa) não têm destaque
    expect(cellByLabel("Defesa entrada área esquerda").style.borderTopColor).toBe("");
  });
});
