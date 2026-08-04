import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import { PlantelListControls } from "@/components/patterns/PlantelListControls";

describe("PlantelListControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("ordenar");
    mockSearchParams.delete("posicao");
    mockSearchParams.delete("view");
  });

  it("não renderiza nada quando não há posições disponíveis", () => {
    const { container } = render(
      <PlantelListControls currentSort="nome" currentPosition={null} availablePositions={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza os 3 separadores de ordenação e o dropdown de posição", () => {
    render(
      <PlantelListControls
        currentSort="nome"
        currentPosition={null}
        availablePositions={["GR", "MC"]}
      />
    );
    expect(screen.getByRole("tab", { name: "Nome" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Número" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Posição" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Todas" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "GR" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "MC" })).toBeInTheDocument();
  });

  it("separador activo tem aria-selected=true", () => {
    render(
      <PlantelListControls currentSort="numero" currentPosition={null} availablePositions={["GR"]} />
    );
    expect(screen.getByRole("tab", { name: "Número" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Nome" })).toHaveAttribute("aria-selected", "false");
  });

  it("ao clicar 'Número' define ?ordenar=numero", () => {
    render(
      <PlantelListControls currentSort="nome" currentPosition={null} availablePositions={["GR"]} />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Número" }));
    expect(mockPush).toHaveBeenCalledWith("?ordenar=numero");
  });

  it("ao clicar 'Nome' remove o param ordenar (é o valor por omissão)", () => {
    mockSearchParams.set("ordenar", "numero");
    render(
      <PlantelListControls currentSort="numero" currentPosition={null} availablePositions={["GR"]} />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Nome" }));
    expect(mockPush).toHaveBeenCalledWith("?");
  });

  it("ao escolher uma posição define ?posicao=<code>", () => {
    render(
      <PlantelListControls
        currentSort="nome"
        currentPosition={null}
        availablePositions={["GR", "MC"]}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "MC" } });
    expect(mockPush).toHaveBeenCalledWith("?posicao=MC");
  });

  it("ao escolher 'Todas' remove o param posicao", () => {
    mockSearchParams.set("posicao", "MC");
    render(
      <PlantelListControls
        currentSort="nome"
        currentPosition="MC"
        availablePositions={["GR", "MC"]}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(mockPush).toHaveBeenCalledWith("?");
  });

  it("preserva o param view=inativos ao mudar ordenação/posição", () => {
    mockSearchParams.set("view", "inativos");
    render(
      <PlantelListControls
        currentSort="nome"
        currentPosition={null}
        availablePositions={["GR"]}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Número" }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("view=inativos")
    );
  });
});
