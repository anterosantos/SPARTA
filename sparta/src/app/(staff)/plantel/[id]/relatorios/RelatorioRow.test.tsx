import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PdfReport } from "@/lib/actions/reports";

vi.mock("@/lib/actions/reports", () => ({
  revokeReport: vi.fn(),
  shareReport: vi.fn(),
}));

vi.mock("@/components/ui/calm-confirmation", () => ({
  CalmConfirmation: ({ message }: any) => <p>{message}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

import { revokeReport, shareReport } from "@/lib/actions/reports";
import { RelatorioRow } from "./RelatorioRow";

const REPORT_ID = "report-0000-0000-0000-000000000001";
const PLAYER_ID = "player-00000000-0000-0000-0000-000000000001";
const CLUB_ID = "club-00000000-0000-0000-0000-000000000001";

function makeReport(overrides: Partial<PdfReport> = {}): PdfReport {
  return {
    id: REPORT_ID,
    scope: "period",
    period_start: "2026-01-01",
    period_end: "2026-01-31",
    generated_at: "2026-01-31T10:00:00Z",
    shared_with_email: null,
    shared_at: null,
    expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    file_path: `${CLUB_ID}/${PLAYER_ID}/report.pdf`,
    ...overrides,
  };
}

describe("RelatorioRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Renderização ---

  it("renderiza label de âmbito e estado não partilhado", () => {
    render(<RelatorioRow report={makeReport()} />);

    expect(screen.getByText(/Período/)).toBeInTheDocument();
    expect(screen.getByText("(não partilhado)", { exact: false })).toBeInTheDocument();
  });

  it("mostra o email quando shared_with_email está preenchido", () => {
    render(<RelatorioRow report={makeReport({ shared_with_email: "treinador@clube.pt" })} />);

    expect(screen.getByText(/treinador@clube\.pt/)).toBeInTheDocument();
  });

  it('mostra badge "Activo" para relatório não expirado', () => {
    render(<RelatorioRow report={makeReport()} />);

    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it('mostra badge "Expirado" para relatório expirado', () => {
    const expired = makeReport({
      expires_at: new Date(Date.now() - 86400000).toISOString(),
    });
    render(<RelatorioRow report={expired} />);

    expect(screen.getByText("Expirado")).toBeInTheDocument();
  });

  it("mostra botões de acção para relatório activo", () => {
    render(<RelatorioRow report={makeReport()} />);

    expect(screen.getByRole("button", { name: "Reenviar link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revogar link" })).toBeInTheDocument();
  });

  it("não mostra botões de acção para relatório expirado", () => {
    const expired = makeReport({
      expires_at: new Date(Date.now() - 86400000).toISOString(),
    });
    render(<RelatorioRow report={expired} />);

    expect(screen.queryByRole("button", { name: "Reenviar link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revogar link" })).not.toBeInTheDocument();
  });

  // --- Fluxo de revogação ---

  it('clique em "Revogar link" mostra diálogo de confirmação', () => {
    render(<RelatorioRow report={makeReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Revogar link" }));

    expect(screen.getByText(/Confirmar revogação/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it('"Cancelar" fecha o diálogo de revogação', () => {
    render(<RelatorioRow report={makeReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Revogar link" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText(/Confirmar revogação/)).not.toBeInTheDocument();
  });

  it("confirmar revogação chama revokeReport e mostra mensagem de sucesso", async () => {
    (revokeReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { revoked: true },
    });

    render(<RelatorioRow report={makeReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Revogar link" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(screen.getByText("Link revogado com sucesso.")).toBeInTheDocument();
    });

    expect(revokeReport).toHaveBeenCalledWith(REPORT_ID);
  });

  it("mostra erro quando revokeReport falha", async () => {
    (revokeReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: { code: "storage_error", message: "Erro ao remover ficheiro do relatório." },
    });

    render(<RelatorioRow report={makeReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Revogar link" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Erro ao remover ficheiro do relatório.",
      );
    });
  });

  // --- Fluxo de partilha ---

  it('clique em "Reenviar link" mostra campo de email', () => {
    render(<RelatorioRow report={makeReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar link" }));

    expect(screen.getByPlaceholderText("email@exemplo.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
  });

  it("partilha com email válido chama shareReport e mostra sucesso", async () => {
    (shareReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { shared: true },
    });

    render(<RelatorioRow report={makeReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar link" }));
    fireEvent.change(screen.getByPlaceholderText("email@exemplo.com"), {
      target: { value: "treinador@clube.pt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(screen.getByText("Relatório partilhado com sucesso.")).toBeInTheDocument();
    });

    expect(shareReport).toHaveBeenCalledWith(REPORT_ID, "treinador@clube.pt");
  });

  it("mostra erro de validação quando email não tem @", async () => {
    render(<RelatorioRow report={makeReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar link" }));
    fireEvent.change(screen.getByPlaceholderText("email@exemplo.com"), {
      target: { value: "invalido" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Introduza um email válido.");
    });

    expect(shareReport).not.toHaveBeenCalled();
  });

  it("pré-preenche o campo de email com shared_with_email do relatório", () => {
    render(<RelatorioRow report={makeReport({ shared_with_email: "prev@exemplo.pt" })} />);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar link" }));

    expect(screen.getByDisplayValue("prev@exemplo.pt")).toBeInTheDocument();
  });

  it('"Cancelar" no fluxo de partilha fecha o campo de email', () => {
    render(<RelatorioRow report={makeReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar link" }));
    expect(screen.getByPlaceholderText("email@exemplo.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByPlaceholderText("email@exemplo.com")).not.toBeInTheDocument();
  });
});
