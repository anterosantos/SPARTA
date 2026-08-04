import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/admin", () => ({
  addPlayerToTeam: vi.fn(),
  removePlayerFromTeam: vi.fn(),
  deletePlayer: vi.fn(),
  deletePlayers: vi.fn(),
  movePlayerToRoster: vi.fn(),
}));

vi.mock("@/lib/actions/data-rights", () => ({
  withdrawConsentByStaff: vi.fn(),
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}));

import { RosterPlayersTable } from "@/app/(staff)/admin/players/RosterPlayersTable";
import { withdrawConsentByStaff } from "@/lib/actions/data-rights";

const rosterPlayers = [
  {
    rosterId: "roster-1",
    rosterName: "Plantel Principal",
    player: {
      id: "player-1",
      full_name: "Malaquias Silva",
      jersey_num: 22,
      age_group: "u14",
    },
    teams: [],
  },
];

describe("RosterPlayersTable — Retirar consentimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("botão de retirar consentimento fica escondido atrás de um passo de expansão", () => {
    render(<RosterPlayersTable rosterPlayers={rosterPlayers} allTeams={[]} allRosters={[]} />);
    expect(screen.getByRole("button", { name: /retirar consentimento/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/escreve/i)).not.toBeInTheDocument();
  });

  it("Confirmar retirada fica desativado até o motivo e o nome exato serem preenchidos", () => {
    render(<RosterPlayersTable rosterPlayers={rosterPlayers} allTeams={[]} allRosters={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /retirar consentimento/i }));

    const confirmBtn = screen.getByRole("button", { name: /confirmar retirada/i });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/motivo/i), { target: { value: "Pedido por telefone" } });
    expect(confirmBtn).toBeDisabled();

    // Nome errado — continua desativado
    fireEvent.change(screen.getByPlaceholderText(/escreve/i), { target: { value: "Nome Errado" } });
    expect(confirmBtn).toBeDisabled();

    // Nome exato — ativa
    fireEvent.change(screen.getByPlaceholderText(/escreve/i), { target: { value: "Malaquias Silva" } });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("ao confirmar, chama withdrawConsentByStaff com o motivo e atualiza a página", async () => {
    vi.mocked(withdrawConsentByStaff).mockResolvedValue({ ok: true, data: { withdrawn: true } });

    render(<RosterPlayersTable rosterPlayers={rosterPlayers} allTeams={[]} allRosters={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /retirar consentimento/i }));
    fireEvent.change(screen.getByPlaceholderText(/motivo/i), {
      target: { value: "Pedido por telefone em 04/08" },
    });
    fireEvent.change(screen.getByPlaceholderText(/escreve/i), { target: { value: "Malaquias Silva" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar retirada/i }));

    await waitFor(() => {
      expect(withdrawConsentByStaff).toHaveBeenCalledWith("player-1", "Pedido por telefone em 04/08");
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("mostra a mensagem de erro do servidor quando a ação falha", async () => {
    vi.mocked(withdrawConsentByStaff).mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Apenas administradores podem retirar consentimento em nome de outrem" },
    });

    render(<RosterPlayersTable rosterPlayers={rosterPlayers} allTeams={[]} allRosters={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /retirar consentimento/i }));
    fireEvent.change(screen.getByPlaceholderText(/motivo/i), { target: { value: "Pedido por telefone" } });
    fireEvent.change(screen.getByPlaceholderText(/escreve/i), { target: { value: "Malaquias Silva" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar retirada/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Apenas administradores podem retirar consentimento em nome de outrem")
      ).toBeInTheDocument();
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("Cancelar recolhe o painel e limpa os campos", () => {
    render(<RosterPlayersTable rosterPlayers={rosterPlayers} allTeams={[]} allRosters={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /retirar consentimento/i }));
    fireEvent.change(screen.getByPlaceholderText(/motivo/i), { target: { value: "Pedido por telefone" } });

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByPlaceholderText(/motivo/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retirar consentimento/i })).toBeInTheDocument();
  });
});
