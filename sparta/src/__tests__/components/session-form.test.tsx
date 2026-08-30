import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/sessions", () => ({
  createSession: vi.fn(),
  updateSession: vi.fn(),
  getSessionTeams: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    refresh: vi.fn(),
  })),
}));

vi.mock("@/components/ui/drill-down-sheet", () => ({
  DrillDownSheet: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="drill-down-sheet">{children}</div> : null),
}));

vi.mock("@/components/ui/calm-confirmation", () => ({
  CalmConfirmation: ({
    message,
    onDismiss,
  }: {
    message: string;
    onDismiss: () => void;
  }) => (
    <div data-testid="calm-confirmation">
      {message}
      <button onClick={onDismiss}>Fechar</button>
    </div>
  ),
}));

import { SessionForm } from "@/app/(staff)/calendario/session-form";
import { createSession, updateSession } from "@/lib/actions/sessions";
import type { Session } from "@/lib/schemas/sessions";

const FUTURE_AT = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const mockSession: Session = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  club_id: "650e8400-e29b-41d4-a716-446655440001",
  season_id: "750e8400-e29b-41d4-a716-446655440002",
  type: "training",
  scheduled_at: FUTURE_AT,
  duration_min: 90,
  location: "Campo Municipal",
  status: "scheduled",
  notes: "Treino normal",
  created_by: "850e8400-e29b-41d4-a716-446655440003",
  created_at: "2026-05-19T00:00:00Z",
  concentration_time: null,
  opponent_name: null,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function localDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Preenche "Data e hora" e "Data e hora de fim" — o formulário exige ambos
 * desde que a duração deixou de ser pedida directamente (é derivada da
 * diferença entre as duas datas). */
function fillSessionDates(startIso: string, durationMin = 90) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMin * 60_000);
  fireEvent.change(screen.getByLabelText(/^data e hora(?! de fim)/i), {
    target: { value: localDateTimeString(start) },
  });
  fireEvent.change(screen.getByLabelText(/data e hora de fim/i), {
    target: { value: localDateTimeString(end) },
  });
}

describe("SessionForm — modo create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza campos do formulário quando hasSeason=true", () => {
    render(<SessionForm mode="create" hasSeason={true} />);
    expect(screen.getByTestId("drill-down-sheet")).toBeInTheDocument();
    expect(screen.getByText("Nova sessão")).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo de sessão/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^data e hora(?! de fim)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/data e hora de fim/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/local/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notas/i)).toBeInTheDocument();
  });

  it("mostra alerta quando hasSeason=false e desabilita botão", () => {
    render(<SessionForm mode="create" hasSeason={false} />);
    expect(screen.getByText(/sem época actual/i)).toBeInTheDocument();
    const submitBtn = screen.getByRole("button", { name: /criar sessão/i });
    expect(submitBtn).toBeDisabled();
  });

  it("o dropdown de tipo contém as 3 opções", () => {
    render(<SessionForm mode="create" hasSeason={true} />);
    expect(screen.getByRole("option", { name: "Treino" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Jogo" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Jogo amigável" })
    ).toBeInTheDocument();
  });

  it("campo 'Equipa adversária' só aparece para Jogo/Jogo amigável", () => {
    render(<SessionForm mode="create" hasSeason={true} />);

    expect(screen.queryByLabelText(/equipa adversária/i)).not.toBeInTheDocument();

    const select = screen.getByLabelText(/tipo de sessão/i);
    fireEvent.change(select, { target: { value: "match" } });
    expect(screen.getByLabelText(/equipa adversária/i)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "friendly" } });
    expect(screen.getByLabelText(/equipa adversária/i)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "training" } });
    expect(screen.queryByLabelText(/equipa adversária/i)).not.toBeInTheDocument();
  });

  it("envia opponentName ao criar um Jogo com equipa adversária preenchida", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    const select = screen.getByLabelText(/tipo de sessão/i);
    fireEvent.change(select, { target: { value: "match" } });

    fireEvent.change(screen.getByLabelText(/equipa adversária/i), {
      target: { value: "SC Vilanovense" },
    });

    fillSessionDates(FUTURE_AT);

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled();
    });
    const [submittedPayload] = vi.mocked(createSession).mock.calls[0]!;
    expect(submittedPayload.opponentName).toBe("SC Vilanovense");
  });

  it("não envia opponentName se o tipo for trocado de volta para Treino antes de submeter (regressão)", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    const select = screen.getByLabelText(/tipo de sessão/i);
    fireEvent.change(select, { target: { value: "match" } });
    fireEvent.change(screen.getByLabelText(/equipa adversária/i), {
      target: { value: "SC Vilanovense" },
    });
    // Muda de ideias antes de submeter — o campo desaparece da UI
    fireEvent.change(select, { target: { value: "training" } });

    fillSessionDates(FUTURE_AT);

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled();
    });
    const [submittedPayload] = vi.mocked(createSession).mock.calls[0]!;
    expect(submittedPayload.opponentName).toBeUndefined();
  });

  it("chama createSession ao submeter e mostra confirmação", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    const select = screen.getByLabelText(/tipo de sessão/i);
    fireEvent.change(select, { target: { value: "match" } });

    fillSessionDates(FUTURE_AT, 60);

    const submitBtn = screen.getByRole("button", { name: /criar sessão/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId("calm-confirmation")).toHaveTextContent(
        "Sessão criada"
      );
    });
  });

  it("calcula durationMin a partir da diferença entre 'Data e hora' e 'Data e hora de fim'", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    fillSessionDates(FUTURE_AT, 45);

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled();
    });
    const [submittedPayload] = vi.mocked(createSession).mock.calls[0]!;
    expect(submittedPayload.durationMin).toBe(45);
  });

  it("mostra erro e não submete quando a data de fim não é preenchida", async () => {
    render(<SessionForm mode="create" hasSeason={true} />);

    fireEvent.change(screen.getByLabelText(/^data e hora(?! de fim)/i), {
      target: { value: localDateTimeString(new Date(FUTURE_AT)) },
    });

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(screen.getByText(/indique a data e hora de fim/i)).toBeInTheDocument();
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("volta para o returnTo (preserva vista/mês do calendário) em vez de /calendario fixo (regressão)", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(
      <SessionForm
        mode="create"
        hasSeason={true}
        returnTo="/calendario?vista=mes&mes=2026-08"
      />
    );

    fillSessionDates(FUTURE_AT);

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(screen.getByTestId("calm-confirmation")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));

    expect(mockPush).toHaveBeenCalledWith("/calendario?vista=mes&mes=2026-08");
  });

  it("converte datetime-local para ISO sem duplicar o offset de timezone (regressão)", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    // Local wall-clock value a user would pick — independent of the test
    // runner's own timezone, so this regresses the double-offset bug
    // regardless of where CI runs.
    const chosenLocal = new Date(Date.now() + 24 * 60 * 60 * 1000);
    chosenLocal.setSeconds(0, 0);

    fillSessionDates(chosenLocal.toISOString(), 60);

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled();
    });

    const [submittedPayload] = vi.mocked(createSession).mock.calls[0]!;
    expect(submittedPayload.scheduledAt).toBe(chosenLocal.toISOString());
  });

  it("mostra erro quando createSession falha", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: false,
      error: { code: "no_season", message: "Sem época actual definida." },
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    fillSessionDates(FUTURE_AT);

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(screen.getByText(/sem época actual/i)).toBeInTheDocument();
    });
  });

  it("campo 'Durante quantas semanas' só aparece quando 'Repetir semanalmente' está marcado", () => {
    render(<SessionForm mode="create" hasSeason={true} />);

    expect(screen.queryByLabelText(/durante quantas semanas/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/repetir semanalmente/i));
    expect(screen.getByLabelText(/durante quantas semanas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/repetir semanalmente/i));
    expect(screen.queryByLabelText(/durante quantas semanas/i)).not.toBeInTheDocument();
  });

  it("envia repeatWeekly e repeatWeeks ao criar sessão com repetição semanal", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    fillSessionDates(FUTURE_AT);

    fireEvent.click(screen.getByLabelText(/repetir semanalmente/i));
    fireEvent.change(screen.getByLabelText(/durante quantas semanas/i), {
      target: { value: "6" },
    });

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled();
    });
    const [submittedPayload] = vi.mocked(createSession).mock.calls[0]!;
    expect(submittedPayload.repeatWeekly).toBe(true);
    expect(submittedPayload.repeatWeeks).toBe(6);
  });

  it("não envia repeatWeeks quando 'Repetir semanalmente' não está marcado", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    fillSessionDates(FUTURE_AT);

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled();
    });
    const [submittedPayload] = vi.mocked(createSession).mock.calls[0]!;
    expect(submittedPayload.repeatWeekly).toBe(false);
    expect(submittedPayload.repeatWeeks).toBeUndefined();
  });

  it("mostra mensagem de confirmação com o número de sessões quando repete semanalmente", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    fillSessionDates(FUTURE_AT);

    fireEvent.click(screen.getByLabelText(/repetir semanalmente/i));
    fireEvent.change(screen.getByLabelText(/durante quantas semanas/i), {
      target: { value: "4" },
    });

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(screen.getByTestId("calm-confirmation")).toHaveTextContent("4 sessões criadas");
    });
  });
});

describe("SessionForm — modo edit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza pré-preenchido com dados da sessão", () => {
    render(<SessionForm mode="edit" session={mockSession} />);
    expect(screen.getByText("Editar sessão")).toBeInTheDocument();
    const select = screen.getByLabelText(/tipo de sessão/i) as HTMLSelectElement;
    expect(select.value).toBe("training");

    // "Data e hora de fim" vem pré-preenchida a partir de scheduled_at + duration_min
    const endInput = screen.getByLabelText(/data e hora de fim/i) as HTMLInputElement;
    const expectedEnd = new Date(
      new Date(mockSession.scheduled_at).getTime() + mockSession.duration_min * 60_000
    );
    expect(endInput.value).toBe(localDateTimeString(expectedEnd));
  });

  it("desabilita formulário quando sessão está cancelada", () => {
    const cancelled: Session = { ...mockSession, status: "cancelled" };
    render(<SessionForm mode="edit" session={cancelled} />);
    expect(screen.getByText(/não pode ser editada/i)).toBeInTheDocument();
    const select = screen.getByLabelText(/tipo de sessão/i) as HTMLSelectElement;
    expect(select).toBeDisabled();
  });

  it("desabilita formulário quando sessão está concluída", () => {
    const completed: Session = { ...mockSession, status: "completed" };
    render(<SessionForm mode="edit" session={completed} />);
    expect(screen.getByText(/não pode ser editada/i)).toBeInTheDocument();
  });

  it("chama updateSession ao submeter", async () => {
    vi.mocked(updateSession).mockResolvedValue({ ok: true, data: mockSession });

    render(<SessionForm mode="edit" session={mockSession} />);

    const submitBtn = screen.getByRole("button", {
      name: /actualizar sessão/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalled();
    });
  });
});
