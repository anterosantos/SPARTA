import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/metrics", () => ({
  addPlayerMetric: vi.fn(),
}));

vi.mock("@/components/ui/drill-down-sheet", () => ({
  DrillDownSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="drill-down-sheet">{children}</div> : null,
}));

import { AddMetricSheet } from "@/components/ui/add-metric-sheet";
import { addPlayerMetric } from "@/lib/actions/metrics";

const PLAYER_ID = "123e4567-e89b-12d3-a456-426614174000";

function openSheet() {
  render(<AddMetricSheet playerId={PLAYER_ID} />);
  fireEvent.click(screen.getByRole("button", { name: /Adicionar leitura/i }));
}

describe("AddMetricSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submete com sucesso preenchendo só o peso (altura vazia)", async () => {
    vi.mocked(addPlayerMetric).mockResolvedValue({ ok: true, data: { id: "metric-1" } as any });
    openSheet();

    fireEvent.input(screen.getByPlaceholderText("ex: 72.50"), { target: { value: "67.4" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(addPlayerMetric).toHaveBeenCalledWith(
        expect.objectContaining({ weight_kg: 67.4, height_cm: undefined })
      );
    });
    // Não deve haver erro de validação na altura
    expect(screen.queryByText(/Invalid input/i)).not.toBeInTheDocument();
  });

  it("submete com sucesso preenchendo só a altura (peso vazio)", async () => {
    vi.mocked(addPlayerMetric).mockResolvedValue({ ok: true, data: { id: "metric-1" } as any });
    openSheet();

    fireEvent.input(screen.getByPlaceholderText("ex: 178.00"), { target: { value: "178" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(addPlayerMetric).toHaveBeenCalledWith(
        expect.objectContaining({ weight_kg: undefined, height_cm: 178 })
      );
    });
    expect(screen.queryByText(/Invalid input/i)).not.toBeInTheDocument();
  });

  it("mostra erro quando nem peso nem altura estão preenchidos", async () => {
    openSheet();

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(screen.getByText("Preenche pelo menos peso ou altura")).toBeInTheDocument();
    });
    expect(addPlayerMetric).not.toHaveBeenCalled();
  });
});
