import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/consent", () => ({
  getParentalConsentLink: vi.fn(),
}));

vi.mock("@/components/ui/drill-down-sheet", () => ({
  DrillDownSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="drill-down-sheet">{children}</div> : null,
}));

import { CopyConsentLinkSheet } from "./copy-consent-link-sheet";
import { getParentalConsentLink } from "@/lib/actions/consent";

const PLAYER_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("CopyConsentLinkSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("renderiza botão 'Copiar Link'", () => {
    render(<CopyConsentLinkSheet playerId={PLAYER_UUID} />);
    expect(screen.getByRole("button", { name: "Copiar Link" })).toBeInTheDocument();
  });

  it("abre o sheet e pede o nome do encarregado antes de gerar o link", async () => {
    render(<CopyConsentLinkSheet playerId={PLAYER_UUID} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar Link" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Nome do encarregado de educação/i)).toBeInTheDocument();
    });
  });

  it("copia o link devolvido pela action para a área de transferência", async () => {
    vi.mocked(getParentalConsentLink).mockResolvedValue({
      ok: true,
      data: { link: "https://sparta-webapp.vercel.app/consentimento/abc123" },
    });

    render(<CopyConsentLinkSheet playerId={PLAYER_UUID} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar Link" }));

    fireEvent.change(screen.getByLabelText(/Nome do encarregado de educação/i), {
      target: { value: "Maria Encarregada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() => {
      expect(getParentalConsentLink).toHaveBeenCalledWith({
        playerId: PLAYER_UUID,
        parentName: "Maria Encarregada",
      });
    });
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://sparta-webapp.vercel.app/consentimento/abc123"
      );
    });
    expect(await screen.findByText(/Link copiado/i)).toBeInTheDocument();
  });

  it("mostra a mensagem de erro devolvida pela action", async () => {
    vi.mocked(getParentalConsentLink).mockResolvedValue({
      ok: false,
      error: { code: "conflict", message: "Já existe um registo de consentimento pending para este jogador" },
    });

    render(<CopyConsentLinkSheet playerId={PLAYER_UUID} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar Link" }));
    fireEvent.change(screen.getByLabelText(/Nome do encarregado de educação/i), {
      target: { value: "Maria" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(
      await screen.findByText("Já existe um registo de consentimento pending para este jogador")
    ).toBeInTheDocument();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
