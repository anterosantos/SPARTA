import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyInviteLinkButton } from "./copy-invite-link-button";
import { getPlayerInviteLink } from "@/lib/actions/players";

vi.mock("@/lib/actions/players", () => ({
  getPlayerInviteLink: vi.fn(),
}));

const PLAYER_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("CopyInviteLinkButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("copia o link devolvido pela action para a área de transferência", async () => {
    vi.mocked(getPlayerInviteLink).mockResolvedValue({
      ok: true,
      data: { link: "https://sparta-webapp.vercel.app/auth/v1/verify?token=abc" },
    });

    render(<CopyInviteLinkButton playerId={PLAYER_UUID} />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() => {
      expect(getPlayerInviteLink).toHaveBeenCalledWith({ playerId: PLAYER_UUID });
    });
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://sparta-webapp.vercel.app/auth/v1/verify?token=abc"
      );
    });
    expect(await screen.findByRole("button", { name: "Copiado!" })).toBeInTheDocument();
  });

  it("mostra estado de erro quando a action falha", async () => {
    vi.mocked(getPlayerInviteLink).mockResolvedValue({
      ok: false,
      error: { code: "no_email", message: "Jogador não tem email registado." },
    });

    render(<CopyInviteLinkButton playerId={PLAYER_UUID} />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(await screen.findByRole("button", { name: "Erro ao copiar" })).toBeInTheDocument();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
