import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/actions/consent", () => ({
  getPlayerConsentStatus: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getPlayerConsentStatus } from "@/lib/actions/consent";
import AguardarConsentimentoPage from "@/app/(player)/aguardar-consentimento/page";

const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";
const FUTURE_ISO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

function mockAuthenticatedUser() {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } } }) },
  } as never);
}

describe("AguardarConsentimentoPage — pedido pendente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra o email mascarado e o botão de reenvio quando o pedido foi por email", async () => {
    mockAuthenticatedUser();
    vi.mocked(getPlayerConsentStatus).mockResolvedValue({
      status: "pending",
      parent_email: "maria@example.com",
      parent_name: null,
      token_expires_at: FUTURE_ISO,
    } as never);

    const jsx = await AguardarConsentimentoPage();
    render(jsx);

    expect(screen.getByText(/Foi enviado um email para/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reenviar email/i })).toBeInTheDocument();
  });

  it("mostra o nome do encarregado (sem menção a email) quando o pedido foi por link", async () => {
    mockAuthenticatedUser();
    vi.mocked(getPlayerConsentStatus).mockResolvedValue({
      status: "pending",
      parent_email: null,
      parent_name: "Maria Encarregada",
      token_expires_at: FUTURE_ISO,
    } as never);

    const jsx = await AguardarConsentimentoPage();
    render(jsx);

    expect(screen.queryByText(/Foi enviado um email para/)).not.toBeInTheDocument();
    expect(screen.getByText(/Maria Encarregada/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reenviar email/i })).not.toBeInTheDocument();
  });

  it("não rebenta quando o pedido é por link e não há nome (defensivo)", async () => {
    mockAuthenticatedUser();
    vi.mocked(getPlayerConsentStatus).mockResolvedValue({
      status: "pending",
      parent_email: null,
      parent_name: null,
      token_expires_at: FUTURE_ISO,
    } as never);

    const jsx = await AguardarConsentimentoPage();
    render(jsx);

    expect(screen.getByText(/A aguardar consentimento/)).toBeInTheDocument();
  });
});
