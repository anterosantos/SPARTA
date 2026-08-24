import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  getRequestUser: vi.fn(),
}));

vi.mock("@/lib/actions/sessions", () => ({
  getSessionsForClub: vi.fn(),
}));

vi.mock("@/lib/actions/seasons", () => ({
  getCurrentSeason: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      id: "850e8400-e29b-41d4-a716-446655440004",
      club_id: "650e8400-e29b-41d4-a716-446655440002",
      name: "2026/27",
      start_date: "2026-08-01",
      end_date: "2027-06-30",
      is_current: true,
      created_at: "2026-05-01T00:00:00Z",
    },
  }),
}));

import { createServerClient, getRequestUser } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import PlayerAgendaPage from "@/app/(player)/agenda/page";

// getRequestUser() substitui a leitura directa de auth.getUser()+profiles que page.tsx
// tinha inline — replica aqui o mesmo caminho a partir do mock de createServerClient já
// configurado por cada teste, para não ter de os reescrever todos.
vi.mocked(getRequestUser).mockImplementation(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, club_id")
    .eq("id", user.id)
    .single();
  return { supabase, user, profile };
});

const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";
const CLUB_UUID = "650e8400-e29b-41d4-a716-446655440002";
const SEASON_UUID = "850e8400-e29b-41d4-a716-446655440004";

const NOW = new Date();
const FUTURE_AT = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

const mockSession1 = {
  id: "session-1",
  club_id: CLUB_UUID,
  season_id: SEASON_UUID,
  type: "training" as const,
  scheduled_at: FUTURE_AT,
  duration_min: 90,
  location: "Campo Municipal",
  status: "scheduled" as const,
  notes: null,
  created_by: USER_UUID,
  created_at: "2026-05-19T00:00:00Z",
};

function makeSupabaseMock(role = "player") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role, club_id: CLUB_UUID },
        error: null,
      }),
    }),
  };
}

describe("PlayerAgendaPage — vista do jogador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza lista de sessões para jogador sem lançar erro", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession1],
    });

    const jsx = await PlayerAgendaPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText(/campo municipal/i)).toBeInTheDocument();
  });

  it("renderiza EmptyState quando não há sessões", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({ ok: true, data: [] });

    const jsx = await PlayerAgendaPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText(/sem sessões agendadas/i)).toBeInTheDocument();
  });

  it("abre por defeito na vista de Mês (sem ?vista= na URL)", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession1],
    });

    const jsx = await PlayerAgendaPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByRole("tab", { name: "Mês" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Semana" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("mostra a vista de Semana quando ?vista=semana está na URL", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession1],
    });

    const jsx = await PlayerAgendaPage({ searchParams: Promise.resolve({ vista: "semana" }) });
    render(jsx);

    // Nota: CalendarViewToggle é client component e lê o seu próprio
    // useSearchParams() (mockado à parte) — aqui confirmamos apenas que o
    // Server Component escolheu a vista de semana (sem grelha de mês).
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});
