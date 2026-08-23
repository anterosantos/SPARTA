"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

/**
 * Server Action: Get current user and their role from profile
 * Uses server-side client that ignores RLS policies
 * Called after login to determine redirect destination
 */
export async function getCurrentUserRole() {
  try {
    console.log("[Auth] Starting getCurrentUserRole");

    const supabase = await createServerClient();
    console.log("[Auth] Server client created");

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("[Auth] getUser result:", { userId: user?.id, userError: userError?.message });

    if (userError || !user) {
      console.log("[Auth] User not found or error");
      return { user: null, role: null, error: "Not authenticated" };
    }

    // Fetch user's role from profile using server client (bypasses RLS)
    console.log("[Auth] Fetching profile for user:", user.id);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    console.log("[Auth] Profile fetch result:", { role: profile?.role, error: profileError?.message });

    if (profileError || !profile) {
      console.warn("[Auth] Could not fetch profile:", profileError?.message);
      return { user, role: null, error: "Profile not found" };
    }

    console.log("[Auth] Success - returning role:", profile.role);
    return { user, role: profile.role as string, error: null };
  } catch (err) {
    console.error("[Auth] Error in getCurrentUserRole:", err);
    return { user: null, role: null, error: "Server error" };
  }
}

/**
 * Server Action: Require staff role (coach or analyst) for protected routes.
 * Returns user info, club ID, and the team IDs the staff member is assigned to.
 * Staff without team assignments see no player data (teamIds = []).
 */
export async function requireStaffRole(): Promise<
  Result<{ userId: string; clubId: string; role: string; teamIds: string[] }, AppError>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return err({ code: "unauthorized", message: "Autenticação necessária." });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return err({ code: "unauthorized", message: "Perfil não encontrado." });
  }

  if (profile.role !== "coach" && profile.role !== "analyst") {
    return err({ code: "forbidden", message: "Acesso restrito a staff." });
  }

  if (!profile.club_id) {
    return err({ code: "forbidden", message: "Clube não atribuído." });
  }

  // Fetch assigned teams via service role (team_coaches RLS uses JWT hook, unreliable in CI)
  const serviceRole = getServiceRoleClient();
  const { data: teamCoaches } = await serviceRole
    .from("team_coaches")
    .select("team_id")
    .eq("profile_id", user.id)
    .eq("is_archived", false);

  const teamIds = (teamCoaches ?? []).map((tc: { team_id: string }) => tc.team_id);

  return ok({
    userId: user.id,
    clubId: profile.club_id,
    role: profile.role as string,
    teamIds,
  });
}

/**
 * Returns the unique player IDs belonging to the given team IDs.
 * Uses service role to bypass RLS on team_players.
 * Returns [] if teamIds is empty (no team assignments → no players visible).
 */
export async function getPlayerIdsForTeams(teamIds: string[]): Promise<string[]> {
  if (teamIds.length === 0) return [];
  const serviceRole = getServiceRoleClient();
  const { data } = await serviceRole
    .from("team_players")
    .select("player_id")
    .in("team_id", teamIds)
    .eq("is_archived", false);
  return [...new Set((data ?? []).map((tp: { player_id: string }) => tp.player_id))];
}

/**
 * Server Action: Require admin role for admin module access.
 * Only users with role='admin' can access /admin routes.
 */
export async function requireAdminRole(): Promise<
  Result<{ userId: string; clubId: string; role: string }, AppError>
> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return err({ code: "unauthorized", message: "Autenticação necessária." });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, club_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return err({ code: "unauthorized", message: "Perfil não encontrado." });
    }

    if (profile.role !== "admin") {
      return err({ code: "forbidden", message: "Acesso restrito a administradores." });
    }

    if (!profile.club_id) {
      return err({ code: "forbidden", message: "Clube não atribuído." });
    }

    return ok({
      userId: user.id,
      clubId: profile.club_id,
      role: profile.role as string,
    });
  } catch (e) {
    // Next.js lança um erro especial (digest DYNAMIC_SERVER_USAGE) quando cookies() é
    // chamado durante a tentativa de pré-renderização estática no build — não é um erro
    // da aplicação, é o mecanismo interno que o Next.js usa para marcar a rota como
    // dinâmica. requireStaffRole (sem try/catch) já deixa isto propagar sem problema;
    // aqui, ao capturar tudo genericamente, estávamos a poluir os logs de build/deploy
    // com "[requireAdminRole] Unexpected error" em todas as rotas /admin/*.
    if ((e as { digest?: string } | null)?.digest === "DYNAMIC_SERVER_USAGE") {
      throw e;
    }
    console.error("[requireAdminRole] Unexpected error:", e);
    return err({ code: "unauthorized", message: "Erro de autenticação." });
  }
}
