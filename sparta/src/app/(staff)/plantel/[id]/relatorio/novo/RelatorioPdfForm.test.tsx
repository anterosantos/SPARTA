import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/reports", () => ({
  generateReport: vi.fn(),
}));

vi.mock("@/components/ui/calm-confirmation", () => ({
  CalmConfirmation: ({ message }: any) => <p>{message}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

import { generateReport } from "@/lib/actions/reports";
import { RelatorioPdfForm } from "./RelatorioPdfForm";

const PLAYER_ID = "player-00000000-0000-0000-0000-000000000001";

describe("RelatorioPdfForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza campos do formulário e botão de submissão", () => {
    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    expect(screen.getByLabelText("Âmbito")).toBeInTheDocument();
    expect(screen.getByLabelText("Início do período")).toBeInTheDocument();
    expect(screen.getByLabelText("Fim do período")).toBeInTheDocument();
    expect(screen.getByLabelText(/Partilhar por email/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar relatório" })).toBeInTheDocument();
  });

  it("select de âmbito contém as três opções", () => {
    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    const select = screen.getByLabelText("Âmbito") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.text);

    expect(options).toContain("Jogos");
    expect(options).toContain("Treinos");
    expect(options).toContain("Período");
  });

  it("mostra erro quando periodStart está vazio", async () => {
    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

    await waitFor(() => {
      expect(screen.getByText("Data de início obrigatória")).toBeInTheDocument();
    });
  });

  it("mostra erro quando periodStart > periodEnd", async () => {
    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    fireEvent.change(screen.getByLabelText("Início do período"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("Fim do período"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

    await waitFor(() => {
      expect(
        screen.getByText("A data de início deve ser anterior ou igual à data de fim"),
      ).toBeInTheDocument();
    });
  });

  it("não submete o formulário quando email é inválido", async () => {
    (generateReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { reportId: "r1", signedUrl: "https://bucket.supabase.co/report.pdf" },
    });

    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    fireEvent.change(screen.getByLabelText("Início do período"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Fim do período"), {
      target: { value: "2026-01-31" },
    });
    fireEvent.change(screen.getByLabelText(/Partilhar por email/), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

    // Validation should block submission — generateReport must not be called
    await waitFor(() => {
      expect(generateReport).not.toHaveBeenCalled();
    });
    expect(screen.queryByText("Descarregar relatório")).not.toBeInTheDocument();
  });

  it("mostra link de download após geração com sucesso", async () => {
    (generateReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { reportId: "rep-1", signedUrl: "https://bucket.supabase.co/report.pdf" },
    });

    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    fireEvent.change(screen.getByLabelText("Início do período"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Fim do período"), {
      target: { value: "2026-01-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

    await waitFor(() => {
      expect(screen.getByText("Descarregar relatório")).toBeInTheDocument();
    });

    expect(generateReport).toHaveBeenCalledWith(
      PLAYER_ID,
      expect.objectContaining({
        scope: "period",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
      }),
    );
  });

  it("passa sharedEmail quando email é válido e fornecido", async () => {
    (generateReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { reportId: "rep-1", signedUrl: "https://bucket.supabase.co/report.pdf" },
    });

    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    fireEvent.change(screen.getByLabelText("Início do período"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Fim do período"), {
      target: { value: "2026-01-31" },
    });
    fireEvent.change(screen.getByLabelText(/Partilhar por email/), {
      target: { value: "treinador@clube.pt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

    await waitFor(() => {
      expect(generateReport).toHaveBeenCalledWith(
        PLAYER_ID,
        expect.objectContaining({ sharedEmail: "treinador@clube.pt" }),
      );
    });
  });

  it("mostra alerta GDPR quando processing_restricted", async () => {
    (generateReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: {
        code: "processing_restricted",
        message:
          "Não é possível gerar relatório — processamento restringido por pedido GDPR.",
      },
    });

    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    fireEvent.change(screen.getByLabelText("Início do período"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Fim do período"), {
      target: { value: "2026-01-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/processamento restringido/);
    });
    expect(screen.queryByText("Descarregar relatório")).not.toBeInTheDocument();
  });

  it("mostra mensagem de erro quando Edge Function falha", async () => {
    (generateReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: { code: "edge_function_error", message: "Falha na geração do relatório." },
    });

    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    fireEvent.change(screen.getByLabelText("Início do período"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Fim do período"), {
      target: { value: "2026-01-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Falha na geração do relatório.");
    });
  });

  it("rejeita signedUrl com protocolo http (não https)", async () => {
    (generateReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { reportId: "rep-1", signedUrl: "http://insecure.example.com/report.pdf" },
    });

    render(<RelatorioPdfForm playerId={PLAYER_ID} />);

    fireEvent.change(screen.getByLabelText("Início do período"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Fim do período"), {
      target: { value: "2026-01-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("URL de download inválida.");
    });
    expect(screen.queryByText("Descarregar relatório")).not.toBeInTheDocument();
  });
});
