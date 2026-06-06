import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/actions/data-rights", () => ({
  checkProcessingRestricted: vi.fn(),
}));

// Mock requireStaffRole directly to avoid internal getServiceRoleClient chain
// (requireStaffRole now queries team_coaches via service role; mocking the
// supabase internals would require threading that through every test)
vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { checkProcessingRestricted } from "@/lib/actions/data-rights";
import { requireStaffRole } from "@/lib/actions/auth";
import { generateReport, getPlayerReports, revokeReport, shareReport } from "../reports";

const PLAYER_ID = "player-00000000-0000-0000-0000-000000000001";
const CLUB_ID = "club-00000000-0000-0000-0000-000000000001";
const USER_ID = "user-00000000-0000-0000-0000-000000000001";
const REPORT_ID = "report-0000-0000-0000-000000000001";

type MockQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
};

function createMockQuery(): MockQuery {
  const q: MockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };
  return q;
}

function setupAuth(
  role = "coach",
  clubId = CLUB_ID,
  userId = USER_ID,
): void {
  (requireStaffRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    data: { userId, clubId, role, teamIds: [] },
  });
}

function setupAuthForbidden(): void {
  (requireStaffRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: false,
    error: { code: "unauthorized", message: "Não autorizado" },
  });
}

// Mock fetch global para Edge Function e Brevo
const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  (checkProcessingRestricted as ReturnType<typeof vi.fn>).mockResolvedValue(false);

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({ ok: true, reportId: REPORT_ID, signedUrl: "https://signed.url/test.pdf" }),
  });

  // Restaurar env vars para testes
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// generateReport
// ---------------------------------------------------------------------------
describe("generateReport", () => {
  it("rejeita quando não é staff (unauthorized)", async () => {
    setupAuthForbidden();

    const result = await generateReport(PLAYER_ID, {
      scope: "period",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["unauthorized", "forbidden"]).toContain(result.error.code);
    }
  });

  it("rejeita quando processing_restricted=true", async () => {
    setupAuth();
    (checkProcessingRestricted as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const playerQuery = createMockQuery();
    playerQuery.maybeSingle.mockResolvedValue({
      data: { id: PLAYER_ID, club_id: CLUB_ID, processing_restricted: true },
      error: null,
    });
    const serviceClient = {
      from: vi.fn().mockReturnValue(playerQuery),
      storage: { from: vi.fn() },
    };
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceClient);

    const result = await generateReport(PLAYER_ID, {
      scope: "period",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("processing_restricted");
    }
  });

  it("rejeita quando player não pertence ao clube", async () => {
    setupAuth();
    (checkProcessingRestricted as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const playerQuery = createMockQuery();
    playerQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    const serviceClient = {
      from: vi.fn().mockReturnValue(playerQuery),
      storage: { from: vi.fn() },
    };
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceClient);

    const result = await generateReport(PLAYER_ID, {
      scope: "period",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("invoca Edge Function com params correctos e retorna reportId+signedUrl", async () => {
    setupAuth();

    const playerQuery = createMockQuery();
    playerQuery.maybeSingle.mockResolvedValue({
      data: { id: PLAYER_ID, club_id: CLUB_ID },
      error: null,
    });
    const invokeMock = vi.fn().mockResolvedValue({
      data: { ok: true, reportId: REPORT_ID, signedUrl: "https://signed.url/test.pdf" },
      error: null,
    });
    const serviceClient = {
      from: vi.fn().mockReturnValue(playerQuery),
      functions: { invoke: invokeMock },
    };
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceClient);

    const result = await generateReport(PLAYER_ID, {
      scope: "match",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      sharedEmail: "test@example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reportId).toBe(REPORT_ID);
      expect(result.data.signedUrl).toContain("signed.url");
    }

    expect(invokeMock).toHaveBeenCalledWith(
      "generate-pdf-report",
      expect.objectContaining({
        body: expect.objectContaining({ playerId: PLAYER_ID }),
      }),
    );
  });

  it("retorna erro quando Edge Function falha", async () => {
    setupAuth();

    const playerQuery = createMockQuery();
    playerQuery.maybeSingle.mockResolvedValue({
      data: { id: PLAYER_ID, club_id: CLUB_ID },
      error: null,
    });
    const invokeMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "edge_function_error" },
    });
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue(playerQuery),
      functions: { invoke: invokeMock },
    });

    const result = await generateReport(PLAYER_ID, {
      scope: "period",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("edge_function_error");
    }
  });
});

// ---------------------------------------------------------------------------
// getPlayerReports
// ---------------------------------------------------------------------------
describe("getPlayerReports", () => {
  const MOCK_REPORT = {
    id: REPORT_ID,
    scope: "period",
    period_start: "2026-01-01",
    period_end: "2026-01-31",
    generated_at: "2026-01-31T10:00:00Z",
    shared_with_email: null,
    shared_at: null,
    expires_at: "2026-03-02T10:00:00Z",
    file_path: `${CLUB_ID}/${PLAYER_ID}/123-period.pdf`,
  };

  it("retorna lista filtrada por player_id + club_id", async () => {
    setupAuth();

    const reportsQuery = createMockQuery();
    reportsQuery.order.mockResolvedValue({ data: [MOCK_REPORT], error: null });
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue(reportsQuery),
    });

    const result = await getPlayerReports(PLAYER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(REPORT_ID);
    }
    // Verificar que o filtro de isolamento por clube foi aplicado
    expect(reportsQuery.eq).toHaveBeenCalledWith("club_id", CLUB_ID);
    expect(reportsQuery.eq).toHaveBeenCalledWith("player_id", PLAYER_ID);
  });

  it("retorna [] quando não há relatórios", async () => {
    setupAuth();

    const reportsQuery = createMockQuery();
    reportsQuery.order.mockResolvedValue({ data: [], error: null });
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue(reportsQuery),
    });

    const result = await getPlayerReports(PLAYER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("rejeita quando não é staff", async () => {
    setupAuthForbidden();

    const result = await getPlayerReports(PLAYER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["unauthorized", "forbidden"]).toContain(result.error.code);
    }
  });
});

// ---------------------------------------------------------------------------
// revokeReport
// ---------------------------------------------------------------------------
describe("revokeReport", () => {
  function setupServiceWithReport(reportData: object | null) {
    const reportQuery = createMockQuery();
    reportQuery.maybeSingle.mockResolvedValue({ data: reportData, error: null });

    const updateQuery = createMockQuery();
    updateQuery.eq.mockResolvedValue({ data: null, error: null });

    const auditQuery = createMockQuery();
    auditQuery.then.mockResolvedValue({ error: null });

    const storageRemoveMock = vi.fn().mockResolvedValue({ error: null });

    const serviceClient = {
      from: vi.fn((table: string) => {
        if (table === "pdf_reports") {
          // First call is maybeSingle (fetch), second is update
          return reportQuery;
        }
        if (table === "audit_logs") return auditQuery;
        return createMockQuery();
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          remove: storageRemoveMock,
        }),
      },
    };
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceClient);
    return { serviceClient, storageRemoveMock, reportQuery, updateQuery };
  }

  it("actualiza expires_at para now() e remove ficheiro do Storage", async () => {
    setupAuth();

    const reportData = {
      id: REPORT_ID,
      player_id: PLAYER_ID,
      file_path: `${CLUB_ID}/${PLAYER_ID}/123-period.pdf`,
      club_id: CLUB_ID,
    };

    const { storageRemoveMock, reportQuery } = setupServiceWithReport(reportData);

    // Simular que o primeiro .eq retorna maybeSingle, e o segundo update retorna sucesso
    reportQuery.eq.mockReturnValueOnce(reportQuery);
    reportQuery.maybeSingle.mockResolvedValueOnce({ data: reportData, error: null });
    reportQuery.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await revokeReport(REPORT_ID);

    expect(result.ok).toBe(true);
    expect(storageRemoveMock).toHaveBeenCalledWith([reportData.file_path]);
  });

  it("retorna not_found quando report não pertence ao clube", async () => {
    setupAuth();
    setupServiceWithReport(null);

    const result = await revokeReport(REPORT_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("cria audit log report.revoked", async () => {
    setupAuth();

    const reportData = {
      id: REPORT_ID,
      player_id: PLAYER_ID,
      file_path: `${CLUB_ID}/${PLAYER_ID}/123-period.pdf`,
      club_id: CLUB_ID,
    };

    const auditInsertMock = vi.fn().mockReturnValue({
      then: vi.fn().mockResolvedValue({ error: null }),
    });

    const storageRemoveMock = vi.fn().mockResolvedValue({ error: null });

    const reportQuery = createMockQuery();
    reportQuery.maybeSingle.mockResolvedValue({ data: reportData, error: null });
    reportQuery.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "pdf_reports") return reportQuery;
        if (table === "audit_logs") return { insert: auditInsertMock };
        return createMockQuery();
      }),
      storage: {
        from: vi.fn().mockReturnValue({ remove: storageRemoveMock }),
      },
    });

    await revokeReport(REPORT_ID);

    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "report.revoked" }),
    );
  });
});

// ---------------------------------------------------------------------------
// shareReport (audit logging)
// ---------------------------------------------------------------------------
describe("shareReport", () => {
  it("cria audit log report.shared", async () => {
    setupAuth();

    const reportData = {
      id: REPORT_ID,
      player_id: PLAYER_ID,
      file_path: `${CLUB_ID}/${PLAYER_ID}/123-period.pdf`,
      club_id: CLUB_ID,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    const auditInsertMock = vi.fn().mockReturnValue({
      then: vi.fn().mockResolvedValue({ error: null }),
    });

    const reportQuery = createMockQuery();
    reportQuery.maybeSingle.mockResolvedValue({ data: reportData, error: null });
    reportQuery.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const playerQuery = createMockQuery();
    playerQuery.maybeSingle.mockResolvedValue({ data: { full_name: "João" }, error: null });

    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "pdf_reports") return reportQuery;
        if (table === "players") return playerQuery;
        if (table === "audit_logs") return { insert: auditInsertMock };
        return createMockQuery();
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://signed.url/test.pdf" },
            error: null,
          }),
        }),
      },
    });

    // Brevo mock
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    process.env.BREVO_API_KEY = "brevo-test-key";
    process.env.BREVO_SENDER_EMAIL = "noreply@test.com";

    const result = await shareReport(REPORT_ID, "recipient@example.com");

    expect(result.ok).toBe(true);
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "report.shared" }),
    );
  });

  it("rejeita email inválido", async () => {
    setupAuth();
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockQuery()),
    });

    const result = await shareReport(REPORT_ID, "invalid-email");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });
});
