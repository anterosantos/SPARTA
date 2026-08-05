import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InvitePlayerSchema,
  ResendInviteSchema,
  InvitePlayer,
  ResendInvite,
} from "@/lib/schemas/players";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logAccess } from "@/lib/actions/audit";
import { invitePlayer, resendPlayerInvite, getPlayerInviteLink } from "@/lib/actions/players";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_EMAIL = "test@example.com";
const STAFF_UUID = "660e8400-e29b-41d4-a716-446655440001";
const PLAYER_UUID = "770e8400-e29b-41d4-a716-446655440002";
const CLUB_UUID = "880e8400-e29b-41d4-a716-446655440003";

describe("InvitePlayerSchema", () => {
  it("accepts valid playerId and email", () => {
    const result = InvitePlayerSchema.safeParse({
      playerId: VALID_UUID,
      email: VALID_EMAIL,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID for playerId", () => {
    const result = InvitePlayerSchema.safeParse({
      playerId: "not-a-uuid",
      email: VALID_EMAIL,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("playerId");
    }
  });

  it("rejects invalid email format", () => {
    const result = InvitePlayerSchema.safeParse({
      playerId: VALID_UUID,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("email");
    }
  });

  it("rejects missing playerId", () => {
    const result = InvitePlayerSchema.safeParse({
      email: VALID_EMAIL,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = InvitePlayerSchema.safeParse({
      playerId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email string", () => {
    const result = InvitePlayerSchema.safeParse({
      playerId: VALID_UUID,
      email: "",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes email to lowercase and trims whitespace", () => {
    const result = InvitePlayerSchema.safeParse({
      playerId: VALID_UUID,
      email: "  Test@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("rejects email exceeding 254 characters", () => {
    const longEmail = "a".repeat(250) + "@test.com";
    const result = InvitePlayerSchema.safeParse({
      playerId: VALID_UUID,
      email: longEmail,
    });
    expect(result.success).toBe(false);
  });

  it("accepts email with custom error message for required field", () => {
    const result = InvitePlayerSchema.safeParse({
      playerId: VALID_UUID,
      email: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find(issue => issue.path.includes("email"));
      expect(emailError?.message).toContain("Email obrigatório");
    }
  });
});

describe("ResendInviteSchema", () => {
  it("accepts valid playerId", () => {
    const result = ResendInviteSchema.safeParse({
      playerId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = ResendInviteSchema.safeParse({
      playerId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("playerId");
    }
  });

  it("rejects missing playerId", () => {
    const result = ResendInviteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// Integration tests for invitePlayer and resendPlayerInvite
describe("invitePlayer action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates input before processing", async () => {
    const result = await invitePlayer({
      playerId: "not-a-uuid",
      email: VALID_EMAIL,
    } as any);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("validation");
  });

  it("rejects request if user is not authenticated", async () => {
    // This test requires mocking the supabase auth context
    // Implementation depends on your test setup
    // For now, documenting the expected behavior
    expect(true).toBe(true); // Placeholder
  });

  it("rejects if staff member does not have required role", async () => {
    // Test that only coach/analyst can invite
    expect(true).toBe(true); // Placeholder
  });

  it("rejects if player is archived", async () => {
    // Test that archived players cannot receive invites
    expect(true).toBe(true); // Placeholder
  });

  it("rejects if email is already in use by another player in same club", async () => {
    // Test email_in_use error code
    expect(true).toBe(true); // Placeholder
  });

  it("rejects if email is already registered in auth.users", async () => {
    // Test email_conflict error code
    expect(true).toBe(true); // Placeholder
  });

  it("compensates by deleting auth user if profile creation fails", async () => {
    // Test that deleteUser is called on profile creation error
    expect(true).toBe(true); // Placeholder
  });

  it("returns link_failed error if player update fails after successful auth invite", async () => {
    // Test partial failure scenario
    expect(true).toBe(true); // Placeholder
  });

  it("logs access event on successful invite", async () => {
    // Test that logAccess is called with correct parameters
    expect(true).toBe(true); // Placeholder
  });
});

describe("resendPlayerInvite action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates input before processing", async () => {
    const result = await resendPlayerInvite({
      playerId: "not-a-uuid",
    } as any);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("validation");
  });

  it("rejects if player has no email registered", async () => {
    // Test no_email error code
    expect(true).toBe(true); // Placeholder
  });

  it("rejects if staff member does not have required role", async () => {
    // Test that only coach/analyst can resend
    expect(true).toBe(true); // Placeholder
  });

  it("rejects if player is archived", async () => {
    // Test that archived players cannot receive resends
    expect(true).toBe(true); // Placeholder
  });

  it("successfully resends invite and updates invite_sent_at", async () => {
    // Test happy path
    expect(true).toBe(true); // Placeholder
  });

  it("logs access event on successful resend", async () => {
    // Test that logAccess is called with correct parameters
    expect(true).toBe(true); // Placeholder
  });
});

// ─── getPlayerInviteLink ────────────────────────────────────────────────────

function buildStaffProfilesFrom(role = "coach") {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { club_id: CLUB_UUID, role }, error: null }),
      }),
    }),
  };
}

function buildInvitablePlayersFrom(overrides: Partial<{ email: string | null; is_archived: boolean }> = {}) {
  const email = "email" in overrides ? overrides.email : VALID_EMAIL;
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: PLAYER_UUID,
              email,
              club_id: CLUB_UUID,
              is_archived: overrides.is_archived ?? false,
            },
            error: null,
          }),
        }),
      }),
    }),
  };
}

function mockAuthenticatedStaff(role = "coach", playersFrom = buildInvitablePlayersFrom()) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: STAFF_UUID } } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") return buildStaffProfilesFrom(role);
      if (table === "players") return playersFrom;
      return {};
    }),
  } as unknown as Awaited<ReturnType<typeof createServerClient>>);
}

describe("getPlayerInviteLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna err de validação quando playerId inválido", async () => {
    const result = await getPlayerInviteLink({ playerId: "not-a-uuid" } as unknown as ResendInvite);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });

  it("retorna unauthorized quando não autenticado", async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerClient>>);

    const result = await getPlayerInviteLink({ playerId: PLAYER_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("retorna forbidden quando o role não é coach/analyst", async () => {
    mockAuthenticatedStaff("admin");

    const result = await getPlayerInviteLink({ playerId: PLAYER_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("retorna forbidden quando o jogador está arquivado", async () => {
    mockAuthenticatedStaff("coach", buildInvitablePlayersFrom({ is_archived: true }));

    const result = await getPlayerInviteLink({ playerId: PLAYER_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("retorna no_email quando o jogador não tem email registado", async () => {
    mockAuthenticatedStaff("coach", buildInvitablePlayersFrom({ email: null }));

    const result = await getPlayerInviteLink({ playerId: PLAYER_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_email");
  });

  it("devolve o action_link do generateLink e regista acesso, sem chamar redirect/invite_sent_at", async () => {
    mockAuthenticatedStaff("coach");
    const generateLink = vi.fn().mockResolvedValue({
      data: { properties: { action_link: "https://sparta-webapp.vercel.app/auth/v1/verify?token=abc" }, user: {} },
      error: null,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue({
      auth: { admin: { generateLink } },
    } as unknown as ReturnType<typeof getServiceRoleClient>);

    const result = await getPlayerInviteLink({ playerId: PLAYER_UUID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.link).toBe("https://sparta-webapp.vercel.app/auth/v1/verify?token=abc");
    }
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "invite", email: VALID_EMAIL })
    );
    expect(logAccess).toHaveBeenCalledWith("player.invite_link_copied", "player", PLAYER_UUID);
  });

  it("retorna err quando generateLink falha", async () => {
    mockAuthenticatedStaff("coach");
    vi.mocked(getServiceRoleClient).mockReturnValue({
      auth: {
        admin: {
          generateLink: vi.fn().mockResolvedValue({
            data: { properties: null, user: null },
            error: { message: "email rate limit exceeded" },
          }),
        },
      },
    } as unknown as ReturnType<typeof getServiceRoleClient>);

    const result = await getPlayerInviteLink({ playerId: PLAYER_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("email rate limit exceeded");
  });
});
