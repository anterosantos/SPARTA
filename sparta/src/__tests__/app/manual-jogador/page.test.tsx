import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ManualJogadorPage from "@/app/manual-jogador/page";

describe("ManualJogadorPage", () => {
  it("renderiza o título e as secções principais sem autenticação", () => {
    render(<ManualJogadorPage />);

    expect(screen.getByRole("heading", { name: "Manual do Jogador", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText("Agenda")).toBeInTheDocument();
    expect(screen.getByText("Questionário de bem-estar")).toBeInTheDocument();
    expect(screen.getByText("Histórico")).toBeInTheDocument();
  });

  it("explica os direitos RGPD e a exceção para menores de 16 anos", () => {
    render(<ManualJogadorPage />);

    expect(screen.getByText(/Os meus direitos/)).toBeInTheDocument();
    expect(screen.getByText(/menos de 16 anos/)).toBeInTheDocument();
  });
});
