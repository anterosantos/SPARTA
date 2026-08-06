import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({
  requireAdminRole: vi.fn(),
}));

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminRole } from "@/lib/actions/auth";
import { resendCoachInvite, getCoachInviteLink } from "@/lib/actions/admin";

const mockRequireAdminRole = requireAdminRole as ReturnType<typeof vi.fn>;
const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;

const ADMIN_UUID = "550e8400-e29b-41d4-a716-446655440000";
const CLUB_UUID = "660e8400-e29b-41d4-a716-446655440001";
const PROFILE_UUID = "770e8400-e29b-41d4-a716-446655440002";
const COACH_EMAIL = "coach@example.com";

function mockAdmin() {
  mockRequireAdminRole.mockResolvedValue({
    ok: true,
    data: { userId: ADMIN_UUID, clubId: CLUB_UUID, role: "admin" },
  });
}

function buildServiceRole({
  profile = { id: PROFILE_UUID, club_id: CLUB_UUID, role: "coach" },
  userEmail = COACH_EMAIL,
  inviteError = null as { message: string } | null,
  generateLinkResult = {
    data: { properties: { action_link: "https://sparta-webapp.vercel.app/auth/v1/verify?token=xyz" }, user: {} } as {
      properties: { action_link: string } | null;
      user: object | null;
    },
    error: null as { message: string } | null,
  },
} = {}) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: userEmail ? { email: userEmail } : null },
          error: null,
        }),
        inviteUserByEmail: vi.fn().mockResolvedValue({ data: {}, error: inviteError }),
        generateLink: vi.fn().mockResolvedValue(generateLinkResult),
      },
    },
  };
}

describe("resendCoachInvite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve unauthorized quando requireAdminRole falha", async () => {
    mockRequireAdminRole.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Autenticação necessária." },
    });

    const result = await resendCoachInvite(PROFILE_UUID);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("UNAUTHORIZED");
  });

  it("devolve NOT_FOUND quando o perfil não existe/não é coach ou analyst do clube", async () => {
    mockAdmin();
    const serviceRole = buildServiceRole();
    serviceRole.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await resendCoachInvite(PROFILE_UUID);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("reenvia o convite com sucesso e regista audit_logs", async () => {
    mockAdmin();
    const serviceRole = buildServiceRole();
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await resendCoachInvite(PROFILE_UUID);

    expect(result.ok).toBe(true);
    expect(serviceRole.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      COACH_EMAIL,
      expect.objectContaining({ data: { club_id: CLUB_UUID, role: "coach" } })
    );
    expect(serviceRole.from).toHaveBeenCalledWith("audit_logs");
  });

  it("devolve erro quando inviteUserByEmail falha", async () => {
    mockAdmin();
    const serviceRole = buildServiceRole({ inviteError: { message: "rate limit" } });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await resendCoachInvite(PROFILE_UUID);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("rate limit");
  });
});

describe("getCoachInviteLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve unauthorized quando requireAdminRole falha", async () => {
    mockRequireAdminRole.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Autenticação necessária." },
    });

    const result = await getCoachInviteLink(PROFILE_UUID);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("UNAUTHORIZED");
  });

  it("devolve o action_link e regista audit_logs", async () => {
    mockAdmin();
    const serviceRole = buildServiceRole();
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await getCoachInviteLink(PROFILE_UUID);

    expect(result.ok).toBe(true);
    expect(result.data?.link).toBe("https://sparta-webapp.vercel.app/auth/v1/verify?token=xyz");
    expect(serviceRole.auth.admin.generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "invite", email: COACH_EMAIL })
    );
    expect(serviceRole.from).toHaveBeenCalledWith("audit_logs");
  });

  it("devolve erro quando generateLink falha", async () => {
    mockAdmin();
    const serviceRole = buildServiceRole({
      generateLinkResult: { data: { properties: null, user: null }, error: { message: "boom" } },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await getCoachInviteLink(PROFILE_UUID);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("boom");
  });

  it("devolve NOT_FOUND quando o utilizador não tem email", async () => {
    mockAdmin();
    const serviceRole = buildServiceRole({ userEmail: "" });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await getCoachInviteLink(PROFILE_UUID);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("NOT_FOUND");
  });
});
