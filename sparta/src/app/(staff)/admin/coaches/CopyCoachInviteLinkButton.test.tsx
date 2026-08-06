import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyCoachInviteLinkButton } from "./CopyCoachInviteLinkButton";
import { getCoachInviteLink } from "@/lib/actions/admin";

vi.mock("@/lib/actions/admin", () => ({
  getCoachInviteLink: vi.fn(),
}));

const PROFILE_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("CopyCoachInviteLinkButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("copia o link devolvido pela action para a área de transferência", async () => {
    vi.mocked(getCoachInviteLink).mockResolvedValue({
      ok: true,
      data: { link: "https://sparta-webapp.vercel.app/auth/v1/verify?token=xyz" },
    });

    render(<CopyCoachInviteLinkButton profileId={PROFILE_UUID} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() => {
      expect(getCoachInviteLink).toHaveBeenCalledWith(PROFILE_UUID);
    });
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://sparta-webapp.vercel.app/auth/v1/verify?token=xyz"
      );
    });
    expect(await screen.findByRole("button", { name: "Copiado!" })).toBeInTheDocument();
  });

  it("mostra estado de erro quando a action falha", async () => {
    vi.mocked(getCoachInviteLink).mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Treinador não encontrado" },
    });

    render(<CopyCoachInviteLinkButton profileId={PROFILE_UUID} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(await screen.findByRole("button", { name: "Erro" })).toBeInTheDocument();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
