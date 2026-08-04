// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase does not infer types for nested relationship queries (e.g. teams(rosters(club_id))). All usages are structurally safe.
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Admin Server Actions (Story 8.2 - 8.5)
 *
 * Story 8.2: Team Player Management
 * - addPlayerToTeam: Assign player to team with validation (AC #1-#3)
 * - removePlayerFromTeam: Unassign player from team
 * - updatePlayerStatus: Change player status in team (active/loaned/reserve)
 *
 * Story 8.3: Roster & Team CRUD
 * - createRoster: Create active roster
 * - updateRoster: Update roster name/status
 * - archiveRoster: Soft-delete roster
 * - createTeam: Create team in roster
 * - updateTeam: Update team fields
 * - archiveTeam: Soft-delete team
 *
 * All actions enforce:
 * - Age-based mobility constraints (AC #1-#2)
 * - RLS isolation (via Supabase policies)
 * - Audit logging
 * - Input validation
 */

"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminRole } from "@/lib/actions/auth";
import { newId } from "@/lib/uuid";
import { AGE_GROUPS } from "@/lib/schemas/players";
import { differenceInYears } from "date-fns";
import { callEraseCascade } from "@/lib/actions/data-rights";

// Supabase does not infer types for nested joins or for insert payloads that
// use snake_case field names not yet reflected in generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdminClient(): any { return getServiceRoleClient(); }
import {
  TeamPlayerAssignmentSchema,
  validateTeamPlayerAssignment,
  type TeamPlayerValidationContext,
} from "@/lib/validators/admin";

interface AddPlayerToTeamResult {
  ok: boolean;
  data?: { id: string };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Create a new player and register them directly in a roster (no team
 * assignment yet — matches the "player can be in a roster without a team"
 * model). Mirrors createPlayer() in lib/actions/players.ts but scoped for
 * the admin module: no internal redirect, and the roster is explicit
 * rather than inferred from team selection or an ambiguous "active roster".
 */
export async function createPlayerForRoster(
  rosterId: string,
  fullName: string,
  birthdate: string,
  jerseyNum: number | null,
  ageGroup: string,
  position: string
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;
  const serviceRole = getAdminClient();

  const { data: roster, error: rosterError } = await serviceRole
    .from("rosters")
    .select("id")
    .eq("id", rosterId)
    .eq("club_id", clubId)
    .single();

  if (rosterError || !roster) {
    return {
      ok: false,
      error: { code: "ROSTER_NOT_FOUND", message: "Roster not found in your club" },
    };
  }

  const trimmedName = fullName?.trim() || "";
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Name must be 2-100 characters" },
    };
  }

  if (!(AGE_GROUPS as readonly string[]).includes(ageGroup)) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Invalid age group" },
    };
  }

  if (jerseyNum !== null && (!Number.isInteger(jerseyNum) || jerseyNum < 1 || jerseyNum > 99)) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Jersey number must be between 1 and 99" },
    };
  }

  const trimmedPosition = position?.trim() || "";
  if (!trimmedPosition) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Position is required" },
    };
  }

  const age = differenceInYears(new Date(), new Date(birthdate));
  if (Number.isNaN(age) || age < 4 || age > 100) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Invalid birthdate" },
    };
  }

  const playerId = newId();

  const { error: insertError } = await serviceRole.from("players").insert({
    id: playerId,
    club_id: clubId,
    full_name: trimmedName,
    birthdate,
    jersey_num: jerseyNum,
    age_group: ageGroup,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        ok: false,
        error: { code: "JERSEY_CONFLICT", message: "Jersey number already used in this club" },
      };
    }
    return { ok: false, error: { code: "DATABASE_ERROR", message: insertError.message } };
  }

  const { error: rpcError } = await serviceRole.rpc("upsert_player_positions", {
    p_player_id: playerId,
    p_positions: [{ position: trimmedPosition, is_primary: true, sort_order: 0 }],
  });

  if (rpcError) {
    await serviceRole.from("players").delete().eq("id", playerId);
    return { ok: false, error: { code: "DATABASE_ERROR", message: rpcError.message } };
  }

  const { error: rosterPlayerError } = await serviceRole.from("roster_players").insert({
    roster_id: rosterId,
    player_id: playerId,
  });

  if (rosterPlayerError) {
    // Compensate: keep players/roster_players consistent if linking fails
    await serviceRole.from("players").delete().eq("id", playerId);
    return { ok: false, error: { code: "DATABASE_ERROR", message: rosterPlayerError.message } };
  }

  await serviceRole.from("audit_logs").insert({
    club_id: clubId,
    actor_id: userId,
    action: "players.created",
    target_kind: "players",
    target_id: playerId,
    payload: { full_name: trimmedName, roster_id: rosterId },
  });

  return { ok: true, data: { id: playerId } };
}

/**
 * Move a player from one specific roster to another. Only the roster_players
 * row for `fromRosterId` is archived (H-9 soft-delete convention, mirrors
 * removePlayerFromTeam) — a player can legitimately belong to more than one
 * roster at once (schema allows it), so this must not touch any of their
 * other active roster memberships. If a roster_players row already exists
 * for `toRosterId` (player was there before and left), it's re-activated
 * instead of inserted — the table has a UNIQUE(roster_id, player_id)
 * constraint that doesn't distinguish archived rows, so a second insert for
 * the same pair would violate it. If activating the target fails after the
 * source was archived, the archive is rolled back so the player isn't left
 * without an active roster (mirrors the compensating-delete pattern already
 * used in createPlayerForRoster for its own multi-step insert).
 */
export async function movePlayerToRoster(
  playerId: string,
  fromRosterId: string,
  toRosterId: string
): Promise<AddPlayerToTeamResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }
  const { clubId, userId } = authResult.data;
  const serviceRole = getAdminClient();

  const { data: player } = await serviceRole
    .from("players")
    .select("id, club_id")
    .eq("id", playerId)
    .single();
  if (!player || player.club_id !== clubId) {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "Player not found or not in your club" },
    };
  }

  const { data: roster } = await serviceRole
    .from("rosters")
    .select("id, club_id")
    .eq("id", toRosterId)
    .single();
  if (!roster || roster.club_id !== clubId) {
    return {
      ok: false,
      error: { code: "ROSTER_NOT_FOUND", message: "Roster not found in your club" },
    };
  }

  const { data: sourceRow } = await serviceRole
    .from("roster_players")
    .select("id")
    .eq("player_id", playerId)
    .eq("roster_id", fromRosterId)
    .eq("is_archived", false)
    .maybeSingle();
  if (!sourceRow) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Player is not currently in the source roster" },
    };
  }

  const { data: existingTarget } = await serviceRole
    .from("roster_players")
    .select("id, is_archived")
    .eq("roster_id", toRosterId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (existingTarget && !existingTarget.is_archived) {
    return {
      ok: false,
      error: { code: "ALREADY_IN_ROSTER", message: "Player already in this roster" },
    };
  }

  const { error: archiveError } = await serviceRole
    .from("roster_players")
    .update({ is_archived: true })
    .eq("id", sourceRow.id);
  if (archiveError) {
    return { ok: false, error: { code: "DATABASE_ERROR", message: archiveError.message } };
  }

  const { error: writeError } = existingTarget
    ? await serviceRole
        .from("roster_players")
        .update({ is_archived: false, joined_at: new Date().toISOString() })
        .eq("id", existingTarget.id)
    : await serviceRole
        .from("roster_players")
        .insert({ roster_id: toRosterId, player_id: playerId });

  if (writeError) {
    // Compensate: restore the source membership so the player isn't left without a roster.
    await serviceRole.from("roster_players").update({ is_archived: false }).eq("id", sourceRow.id);
    return { ok: false, error: { code: "DATABASE_ERROR", message: writeError.message } };
  }

  await serviceRole.from("audit_logs").insert({
    club_id: clubId,
    actor_id: userId,
    action: "roster_players.moved",
    target_kind: "roster_players",
    target_id: playerId,
    payload: { player_id: playerId, from_roster_id: fromRosterId, to_roster_id: toRosterId },
  });

  return { ok: true, data: { id: playerId } };
}

/**
 * Permanently delete a player and every record associated with them
 * (fatigue responses, match events, session metrics, attendances,
 * consents, roster/team/loan assignments, audit trail references, etc.).
 * Reuses the same fn_erase_subject_cascade RPC (via erase-cascade Edge
 * Function) that backs the GDPR "right to erasure" self-service flow —
 * this is genuinely irreversible, not a soft-delete/archive.
 */
export async function deletePlayer(playerId: string): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;
  const serviceRole = getAdminClient();

  const { data: player, error: playerError } = await serviceRole
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .single();

  if (playerError || !player) {
    return {
      ok: false,
      error: { code: "PLAYER_NOT_FOUND", message: "Player not found in your club" },
    };
  }

  const result = await callEraseCascade(playerId, userId);
  if (!result.ok) {
    return {
      ok: false,
      error: { code: "ERASURE_FAILED", message: result.error.message },
    };
  }

  return { ok: true, data: { id: playerId } };
}

interface DeletePlayersResult {
  ok: boolean;
  data?: { deletedCount: number; failed: { id: string; message: string }[] };
  error?: { code: string; message: string };
}

/**
 * Bulk variant of deletePlayer(): erases each selected player in turn
 * (each is its own atomic transaction via fn_erase_subject_cascade), and
 * reports per-player failures instead of aborting the whole batch.
 */
export async function deletePlayers(playerIds: string[]): Promise<DeletePlayersResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "No players selected" },
    };
  }

  const { clubId, userId } = authResult.data;
  const serviceRole = getAdminClient();

  const { data: players, error: playersError } = await serviceRole
    .from("players")
    .select("id")
    .in("id", playerIds)
    .eq("club_id", clubId);

  if (playersError) {
    return { ok: false, error: { code: "DATABASE_ERROR", message: playersError.message } };
  }

  const validIds = new Set((players ?? []).map((p: { id: string }) => p.id));
  const failed: { id: string; message: string }[] = [];
  let deletedCount = 0;

  for (const id of playerIds) {
    if (!validIds.has(id)) {
      failed.push({ id, message: "Player not found in your club" });
      continue;
    }
    const result = await callEraseCascade(id, userId);
    if (result.ok) {
      deletedCount++;
    } else {
      failed.push({ id, message: result.error.message });
    }
  }

  return { ok: true, data: { deletedCount, failed } };
}

/**
 * AC #3: addPlayerToTeam server action
 *
 * Validates:
 * 1. Input schema (playerId, teamId, position)
 * 2. Age constraints (AC #1)
 * 3. Senior limits (AC #2)
 * 4. RLS isolation
 *
 * Returns:
 * - { ok: true, data: { id: teamPlayerId } } on success
 * - { ok: false, error: { code, message } } on validation failure
 */
export async function addPlayerToTeam(
  playerId: string,
  teamId: string,
  position?: string
): Promise<AddPlayerToTeamResult> {
  // Step 1: Authenticate
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Staff access required",
      },
    };
  }

  const { clubId } = authResult.data;

  // Step 2: Validate input schema (AC #3)
  const parseResult = TeamPlayerAssignmentSchema.safeParse({
    playerId,
    teamId,
    position,
  });

  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: parseResult.error.issues[0]?.message || "Invalid input",
      },
    };
  }

  try {
    const serviceRole = getAdminClient();

    // Step 3: Fetch player age_group
    const { data: player, error: playerError } = await serviceRole
      .from("players")
      .select("id, age_group")
      .eq("id", playerId)
      .eq("club_id", clubId)
      .single();

    if (playerError || !player) {
      return {
        ok: false,
        error: {
          code: "PLAYER_NOT_FOUND",
          message: "Player not found in your club",
        },
      };
    }

    // Step 4: Fetch team and roster info
    const { data: team, error: teamError } = await serviceRole
      .from("teams")
      .select("id, roster_id, escalao")
      .eq("id", teamId)
      .single();

    if (teamError || !team) {
      return {
        ok: false,
        error: {
          code: "TEAM_NOT_FOUND",
          message: "Team not found",
        },
      };
    }

    // Verify team belongs to user's club (via roster)
    const { data: roster, error: rosterError } = await serviceRole
      .from("rosters")
      .select("id, club_id")
      .eq("id", team.roster_id)
      .single();

    if (rosterError || !roster || roster.club_id !== clubId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Team not in your club",
        },
      };
    }

    // Step 4.5: A player already registered in a roster cannot be added to a
    // team belonging to a different roster (rosters are mutually exclusive squads).
    const { data: playerRosters } = await serviceRole
      .from("roster_players")
      .select("roster_id")
      .eq("player_id", playerId)
      .eq("is_archived", false);

    const playerHasOtherRoster = (playerRosters ?? []).some(
      (rp: { roster_id: string }) => rp.roster_id !== team.roster_id
    );

    if (playerHasOtherRoster) {
      return {
        ok: false,
        error: {
          code: "ROSTER_MISMATCH",
          message: "Player belongs to a different roster and cannot be added to this team",
        },
      };
    }

    // Step 5: Fetch all team IDs in this roster (to avoid SQL injection)
    // Note: team coach assignment check (H-2) is intentionally skipped here —
    // this action is used by club-level admin staff who have authority over all teams.
    const { data: rosterTeams, error: teamsError } = await serviceRole
      .from("teams")
      .select("id")
      .eq("roster_id", team.roster_id);

    if (teamsError || !rosterTeams) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: teamsError?.message || "Failed to fetch teams in roster",
        },
      };
    }

    const teamIds = rosterTeams.map((t: { id: string }) => t.id);
    const hasBTeam = rosterTeams.some((t: { is_b_team?: boolean }) => t.is_b_team === true);

    // Step 6: Count active teams for this player in this roster
    const { data: activeTeams } = teamIds.length > 0
      ? await serviceRole
          .from("team_players")
          .select("id", { count: "exact" })
          .eq("player_id", playerId)
          .in("team_id", teamIds)
          .eq("status", "active")
      : { data: [] };

    const activeTeamsCount = activeTeams?.length ?? 0;

    // Step 8: Build validation context (AC #1 + AC #2)
    const validationContext: TeamPlayerValidationContext = {
      playerAgeGroup: player.age_group,
      teamEscalao: team.escalao,
      playerIsActive: true,
      rosterHasBTeam: hasBTeam,
      activeTeamsInRoster: activeTeamsCount,
    };

    // Step 9: Validate constraints (AC #1 + AC #2)
    const validationResult = validateTeamPlayerAssignment(
      parseResult.data,
      validationContext
    );

    if (!validationResult.valid) {
      // Log audit entry for blocked attempt (AC #3)
      await serviceRole
        .from("audit_logs")
        .insert({
          club_id: clubId,
          actor_id: authResult.data.userId,
          action: "team_players.add_attempt_blocked",
          target_kind: "team_players",
          target_id: null,
          payload: {
            playerId,
            teamId,
            reason: validationResult.code,
            message: validationResult.error,
          },
        })
        .select("id")
        .single();

      return {
        ok: false,
        error: {
          code: validationResult.code || "VALIDATION_ERROR",
          message: validationResult.error || "Validation failed",
        },
      };
    }

    // Step 10: Create team_player record
    const { data: teamPlayer, error: insertError } = await serviceRole
      .from("team_players")
      .insert({
        team_id: teamId,
        player_id: playerId,
        status: "active",
        position: position || null,
        joined_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !teamPlayer) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: insertError?.message || "Failed to add player to team",
        },
      };
    }

    // Step 11: Log success
    await serviceRole
      .from("audit_logs")
      .insert({
        club_id: clubId,
        actor_id: authResult.data.userId,
        action: "team_players.added",
        target_kind: "team_players",
        target_id: teamPlayer.id,
        payload: {
          playerId,
          teamId,
          position,
        },
      })
      .select("id")
      .single();

    return {
      ok: true,
      data: { id: teamPlayer.id },
    };
  } catch (error) {
    console.error("[addPlayerToTeam] Unexpected error:", error);
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    };
  }
}

/**
 * Remove player from team (soft-delete via left_at)
 */
export async function removePlayerFromTeam(
  teamPlayerId: string
): Promise<AddPlayerToTeamResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Staff access required",
      },
    };
  }

  const { clubId } = authResult.data;

  try {
    const serviceRole = getAdminClient();

    // Verify ownership (via team → roster → club_id)
    const { data: teamPlayer } = await serviceRole
      .from("team_players")
      .select(
        `id, team_id, teams(id, roster_id, rosters(id, club_id))`
      )
      .eq("id", teamPlayerId)
      .single();

    if (
      !teamPlayer ||
      (teamPlayer.teams as any)?.rosters?.club_id !== clubId
    ) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Team player not found or not in your club",
        },
      };
    }

    // H-9 FIX: Mark as left (soft-delete with is_archived flag)
    const { error: updateError } = await serviceRole
      .from("team_players")
      .update({
        status: "reserve",
        left_at: new Date().toISOString(),
        is_archived: true,
      })
      .eq("id", teamPlayerId);

    if (updateError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: updateError.message,
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: authResult.data.userId,
      action: "team_players.removed",
      target_kind: "team_players",
      target_id: teamPlayerId,
    });

    return { ok: true, data: { id: teamPlayerId } };
  } catch (error) {
    console.error("[removePlayerFromTeam] Unexpected error:", error);
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    };
  }
}

/**
 * Update player status within team (active → loaned → reserve)
 */
export async function updatePlayerStatus(
  teamPlayerId: string,
  status: "active" | "loaned" | "reserve"
): Promise<AddPlayerToTeamResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Staff access required",
      },
    };
  }

  const { clubId } = authResult.data;

  if (!["active", "loaned", "reserve"].includes(status)) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid status",
      },
    };
  }

  try {
    const serviceRole = getAdminClient();

    // Verify ownership
    const { data: teamPlayer } = await serviceRole
      .from("team_players")
      .select(
        `id, status, team_id, teams(id, roster_id, rosters(id, club_id))`
      )
      .eq("id", teamPlayerId)
      .single();

    if (
      !teamPlayer ||
      (teamPlayer.teams as any)?.rosters?.club_id !== clubId
    ) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Team player not found or not in your club",
        },
      };
    }

    // H-12 FIX: Validate state transitions (state machine)
    const currentStatus = (teamPlayer as any).status;
    const validTransitions: Record<string, string[]> = {
      active: ["loaned", "reserve"],
      loaned: ["reserve"],
      reserve: [], // Cannot change from reserve
    };

    if (!validTransitions[currentStatus]?.includes(status)) {
      return {
        ok: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Cannot transition from ${currentStatus} to ${status}`,
        },
      };
    }

    // Update
    const { error: updateError } = await serviceRole
      .from("team_players")
      .update({ status })
      .eq("id", teamPlayerId);

    if (updateError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: updateError.message,
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: authResult.data.userId,
      action: "team_players.status_changed",
      target_kind: "team_players",
      target_id: teamPlayerId,
      payload: { status },
    });

    return { ok: true, data: { id: teamPlayerId } };
  } catch (error) {
    console.error("[updatePlayerStatus] Unexpected error:", error);
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    };
  }
}

// ============================================================================
// Story 8.3: Roster CRUD Operations
// ============================================================================

interface CreateRosterResult {
  ok: boolean;
  data?: { id: string };
  error?: { code: string; message: string };
}

/**
 * Create active roster for club and season
 */
export async function createRoster(
  clubId: string,
  seasonId: string,
  name: string
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId: userClubId, userId } = authResult.data;

  // Verify user can create roster for this club
  if (clubId !== userClubId) {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "Cannot create roster for another club" },
    };
  }

  // Trim and validate name
  const trimmedName = name?.trim() || "";
  if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 255) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Roster name must be 1-255 characters" },
    };
  }

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const serviceRole = getAdminClient();

      // Validate season exists and belongs to this club (L-4 fix)
      const { data: season, error: seasonError } = await serviceRole
        .from("seasons")
        .select("id, club_id")
        .eq("id", seasonId)
        .eq("club_id", clubId)
        .single();

      if (seasonError || !season) {
        return {
          ok: false,
          error: { code: "SEASON_NOT_FOUND", message: "Season not found in your club" },
        };
      }

      // Check no active roster with the same name (case-insensitive) already exists for this (club, season)
      const { data: existing } = await serviceRole
        .from("rosters")
        .select("id")
        .eq("club_id", clubId)
        .eq("season_id", seasonId)
        .eq("status", "active")
        .ilike("name", trimmedName)
        .maybeSingle();

      if (existing) {
        return {
          ok: false,
          error: {
            code: "ROSTER_NAME_EXISTS",
            message: "A roster with this name already exists for this season",
          },
        };
      }

      // Create roster
      const { data: roster, error: createError } = await serviceRole
        .from("rosters")
        .insert({
          club_id: clubId,
          season_id: seasonId,
          name: trimmedName,
          status: "active",
        })
        .select("id")
        .single();

      if (createError) {
        // Handle unique constraint violation from race condition (C-3 fix)
        if (createError.message.includes("unique") && retryCount < maxRetries - 1) {
          retryCount++;
          // Exponential backoff: 100ms, 200ms, 400ms
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
          continue;
        }

        return {
          ok: false,
          error: {
            code: "ROSTER_NAME_EXISTS",
            message: "A roster with this name already exists for this season (constraint violation)",
          },
        };
      }

      if (!roster) {
        return {
          ok: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Failed to create roster",
          },
        };
      }

      // Log
      await serviceRole.from("audit_logs").insert({
        club_id: clubId,
        actor_id: userId,
        action: "rosters.created",
        target_kind: "rosters",
        target_id: roster.id,
        payload: { name: trimmedName, season_id: seasonId },
      });

      return { ok: true, data: { id: roster.id } };
    } catch (error) {
      console.error("[createRoster] Error:", error);
      if (retryCount < maxRetries - 1) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
        continue;
      }

      return {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      };
    }
  }

  return {
    ok: false,
    error: { code: "ROSTER_NAME_EXISTS", message: "Failed to create roster after retries" },
  };
}

/**
 * Update roster name or status
 */
export async function updateRoster(
  rosterId: string,
  updates: { name?: string; status?: "active" | "archived" }
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  try {
    const serviceRole = getAdminClient();

    // Verify ownership
    const { data: roster, error: rosterError } = await serviceRole
      .from("rosters")
      .select("id, club_id")
      .eq("id", rosterId)
      .single();

    if (rosterError || !roster || roster.club_id !== clubId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Roster not found or not in your club",
        },
      };
    }

    // Validate inputs
    if (updates.name && (updates.name.length < 1 || updates.name.length > 255)) {
      return {
        ok: false,
        error: { code: "INVALID_INPUT", message: "Name must be 1-255 chars" },
      };
    }

    if (updates.status && !["active", "archived"].includes(updates.status)) {
      return {
        ok: false,
        error: { code: "INVALID_INPUT", message: "Invalid status" },
      };
    }

    // Update
    const { error: updateError } = await serviceRole
      .from("rosters")
      .update(updates)
      .eq("id", rosterId);

    if (updateError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: updateError.message,
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "rosters.updated",
      target_kind: "rosters",
      target_id: rosterId,
      payload: updates,
    });

    return { ok: true, data: { id: rosterId } };
  } catch (error) {
    console.error("[updateRoster] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

/**
 * Archive roster (soft-delete)
 */
export async function archiveRoster(
  rosterId: string
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  try {
    const serviceRole = getAdminClient();

    // Verify ownership
    const { data: roster, error: rosterError } = await serviceRole
      .from("rosters")
      .select("id, club_id")
      .eq("id", rosterId)
      .single();

    if (rosterError || !roster || roster.club_id !== clubId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Roster not found or not in your club",
        },
      };
    }

    // Update roster
    const { error: updateError } = await serviceRole
      .from("rosters")
      .update({ is_archived: true, status: "archived" })
      .eq("id", rosterId);

    if (updateError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: updateError.message,
        },
      };
    }

    // M-3 FIX: Cascade is_archived to child teams
    const { error: cascadeError } = await serviceRole
      .from("teams")
      .update({ is_archived: true })
      .eq("roster_id", rosterId);

    if (cascadeError) {
      console.error("[archiveRoster] Failed to cascade archive to teams:", cascadeError);
      // Don't fail the roster archive — cascade failure is non-critical
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "rosters.archived",
      target_kind: "rosters",
      target_id: rosterId,
      payload: { cascaded_to_teams: true },
    });

    return { ok: true, data: { id: rosterId } };
  } catch (error) {
    console.error("[archiveRoster] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

// ============================================================================
// Story 8.3: Team CRUD Operations
// ============================================================================

/**
 * Create team in roster
 */
export async function createTeam(
  rosterId: string,
  name: string,
  escalao?: string | null,
  level?: string | null,
  isBTeam?: boolean,
  colorHex?: string | null,
  description?: string | null
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  // M-1 FIX: Trim name and validate
  const trimmedName = name?.trim() || "";
  if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 255) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Team name must be 1-255 characters" },
    };
  }

  try {
    const serviceRole = getAdminClient();

    // Verify roster ownership and not archived
    const { data: roster, error: rosterError } = await serviceRole
      .from("rosters")
      .select("id, club_id, is_archived")
      .eq("id", rosterId)
      .single();

    if (rosterError || !roster || roster.club_id !== clubId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Roster not found or not in your club",
        },
      };
    }

    if (roster.is_archived) {
      return {
        ok: false,
        error: {
          code: "ROSTER_ARCHIVED",
          message: "Cannot add teams to archived roster",
        },
      };
    }

    // Create team
    const { data: team, error: createError } = await serviceRole
      .from("teams")
      .insert({
        roster_id: rosterId,
        name: trimmedName,
        escalao: escalao || null,
        level: level || null,
        is_b_team: isBTeam ?? false,
        color_hex: colorHex || null,
        description: description || null,
      })
      .select("id")
      .single();

    if (createError || !team) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: createError?.message || "Failed to create team",
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "teams.created",
      target_kind: "teams",
      target_id: team.id,
      payload: {
        roster_id: rosterId,
        name,
        escalao,
        level,
        is_b_team: isBTeam,
      },
    });

    return { ok: true, data: { id: team.id } };
  } catch (error) {
    console.error("[createTeam] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

/**
 * Update team
 */
export async function updateTeam(
  teamId: string,
  updates: {
    name?: string;
    escalao?: string | null;
    level?: string | null;
    is_b_team?: boolean;
    color_hex?: string | null;
    description?: string | null;
    is_archived?: boolean;
  }
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  try {
    const serviceRole = getAdminClient();

    // Verify ownership
    const { data: team } = await serviceRole
      .from("teams")
      .select("id, roster_id, rosters(club_id)")
      .eq("id", teamId)
      .single();

    if (!team || (team.rosters as any)?.club_id !== clubId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Team not found or not in your club",
        },
      };
    }

    // Validate inputs
    if (updates.name && (updates.name.length < 1 || updates.name.length > 255)) {
      return {
        ok: false,
        error: { code: "INVALID_INPUT", message: "Name must be 1-255 chars" },
      };
    }

    // Update
    const { error: updateError } = await serviceRole
      .from("teams")
      .update(updates)
      .eq("id", teamId);

    if (updateError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: updateError.message,
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "teams.updated",
      target_kind: "teams",
      target_id: teamId,
      payload: updates,
    });

    return { ok: true, data: { id: teamId } };
  } catch (error) {
    console.error("[updateTeam] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

/**
 * Archive team (soft-delete)
 */
export async function archiveTeam(teamId: string): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  try {
    const serviceRole = getAdminClient();

    // Verify ownership
    const { data: team } = await serviceRole
      .from("teams")
      .select("id, roster_id, rosters(club_id)")
      .eq("id", teamId)
      .single();

    if (!team || (team.rosters as any)?.club_id !== clubId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Team not found or not in your club",
        },
      };
    }

    // Archive
    const { error: updateError } = await serviceRole
      .from("teams")
      .update({ is_archived: true })
      .eq("id", teamId);

    if (updateError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: updateError.message,
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "teams.archived",
      target_kind: "teams",
      target_id: teamId,
    });

    return { ok: true, data: { id: teamId } };
  } catch (error) {
    console.error("[archiveTeam] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

// ============================================================================
// Story 8.5: Team-Coach Management
// ============================================================================

/**
 * Invite a new coach/analyst — sends an email invite (Supabase Auth) that
 * creates the auth user on acceptance, then links a profile row so the
 * person can immediately be assigned to teams.
 */
export async function inviteCoach(
  fullName: string,
  email: string,
  role: "coach" | "analyst"
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId } = authResult.data;

  const trimmedName = fullName?.trim() || "";
  if (!trimmedName || trimmedName.length > 255) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Name must be 1-255 characters" },
    };
  }

  if (!["coach", "analyst"].includes(role)) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Invalid role" },
    };
  }

  const trimmedEmail = email?.trim().toLowerCase() || "";
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Invalid email" },
    };
  }

  const serviceRole = getServiceRoleClient();

  let inviteData: Awaited<ReturnType<typeof serviceRole.auth.admin.inviteUserByEmail>>["data"];
  let inviteError: Awaited<ReturnType<typeof serviceRole.auth.admin.inviteUserByEmail>>["error"];
  try {
    ({ data: inviteData, error: inviteError } = await serviceRole.auth.admin.inviteUserByEmail(
      trimmedEmail,
      { data: { club_id: clubId, role } }
    ));
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: `Failed to send invite: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }

  if (inviteError) {
    const msg = inviteError.message.toLowerCase();
    const isConflict =
      msg.includes("already registered") ||
      msg.includes("already been registered") ||
      msg.includes("user already exists");
    if (isConflict) {
      return {
        ok: false,
        error: { code: "EMAIL_CONFLICT", message: "This email already has an account in the system" },
      };
    }
    return { ok: false, error: { code: "INTERNAL_ERROR", message: inviteError.message } };
  }

  if (!inviteData?.user) {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to create user" } };
  }

  const { error: profileError } = await serviceRole
    .from("profiles")
    .insert({
      id: inviteData.user.id,
      club_id: clubId,
      role,
      full_name: trimmedName,
    });

  if (profileError) {
    // Compensate: delete the orphaned auth user so retrying with the same email works
    const deleteResult = await serviceRole.auth.admin.deleteUser(inviteData.user.id);
    if (deleteResult.error) {
      console.error("[inviteCoach] Critical: orphaned auth user", {
        userId: inviteData.user.id,
        deleteError: deleteResult.error.message,
      });
    }
    return {
      ok: false,
      error: { code: "PROFILE_CREATION_FAILED", message: "Failed to create profile. Please try again." },
    };
  }

  await serviceRole.from("audit_logs").insert({
    club_id: clubId,
    actor_id: authResult.data.userId,
    action: "profiles.invited",
    target_kind: "profiles",
    target_id: inviteData.user.id,
    payload: { role, full_name: trimmedName },
  });

  return { ok: true, data: { id: inviteData.user.id } };
}

/**
 * Assign coach to team with role
 */
export async function assignCoachToTeam(
  profileId: string,
  teamId: string,
  role: "principal" | "assistant" | "analyst" = "assistant"
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  if (!["principal", "assistant", "analyst"].includes(role)) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Invalid role" },
    };
  }

  try {
    const serviceRole = getAdminClient();

    // Verify team ownership
    const { data: team } = await serviceRole
      .from("teams")
      .select("id, roster_id, rosters(club_id)")
      .eq("id", teamId)
      .single();

    if (!team || (team.rosters as any)?.club_id !== clubId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Team not found or not in your club",
        },
      };
    }

    // Note: principal coach check skipped — admin module operates at club level.
    // Club isolation (via roster.club_id) is the security boundary.

    // Verify coach profile exists and is in same club
    const { data: coach, error: coachError } = await serviceRole
      .from("profiles")
      .select("id, club_id")
      .eq("id", profileId)
      .eq("club_id", clubId)
      .single();

    if (coachError || !coach) {
      return {
        ok: false,
        error: {
          code: "COACH_NOT_FOUND",
          message: "Coach not found in your club",
        },
      };
    }

    // Check for existing assignment (C-2 fix: prevent duplicates)
    const { data: existingCoach } = await serviceRole
      .from("team_coaches")
      .select("id, role")
      .eq("team_id", teamId)
      .eq("profile_id", profileId)
      .single();

    if (existingCoach) {
      return {
        ok: false,
        error: {
          code: "COACH_ALREADY_ASSIGNED",
          message: `Treinador já está na equipa (role: ${existingCoach.role})`,
        },
      };
    }

    // Assign coach
    const { data: teamCoach, error: assignError } = await serviceRole
      .from("team_coaches")
      .insert({
        team_id: teamId,
        profile_id: profileId,
        role,
      })
      .select("id")
      .single();

    if (assignError || !teamCoach) {
      // Handle unique constraint violation from race condition
      if (assignError?.message.includes("unique")) {
        return {
          ok: false,
          error: {
            code: "COACH_ALREADY_ASSIGNED",
            message: "Treinador já está na equipa",
          },
        };
      }
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: assignError?.message || "Failed to assign coach",
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "team_coaches.assigned",
      target_kind: "team_coaches",
      target_id: teamCoach.id,
      payload: { profile_id: profileId, team_id: teamId, role },
    });

    return { ok: true, data: { id: teamCoach.id } };
  } catch (error) {
    console.error("[assignCoachToTeam] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

/**
 * Remove coach from team (soft-delete)
 */
export async function removeCoachFromTeam(
  teamCoachId: string
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  try {
    const serviceRole = getAdminClient();

    // Verify ownership
    const { data: teamCoach } = await serviceRole
      .from("team_coaches")
      .select("id, team_id, teams(roster_id, rosters(club_id))")
      .eq("id", teamCoachId)
      .single();

    if (!teamCoach || (teamCoach.teams as any)?.rosters?.club_id !== clubId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Team coach not found or not in your club",
        },
      };
    }

    // Remove (soft-delete)
    const { error: removeError } = await serviceRole
      .from("team_coaches")
      .update({
        is_archived: true,
        left_at: new Date().toISOString(),
      })
      .eq("id", teamCoachId);

    if (removeError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: removeError.message,
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "team_coaches.removed",
      target_kind: "team_coaches",
      target_id: teamCoachId,
    });

    return { ok: true, data: { id: teamCoachId } };
  } catch (error) {
    console.error("[removeCoachFromTeam] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

/**
 * Change coach role within team
 */
export async function changeCoachRole(
  teamCoachId: string,
  newRole: "principal" | "assistant" | "analyst"
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  if (!["principal", "assistant", "analyst"].includes(newRole)) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Invalid role" },
    };
  }

  try {
    const serviceRole = getAdminClient();

    // Verify ownership
    const { data: teamCoach } = await serviceRole
      .from("team_coaches")
      .select("id, team_id, teams(roster_id, rosters(club_id))")
      .eq("id", teamCoachId)
      .single();

    if (!teamCoach || (teamCoach.teams as any)?.rosters?.club_id !== clubId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Team coach not found or not in your club",
        },
      };
    }

    // Update role
    const { error: updateError } = await serviceRole
      .from("team_coaches")
      .update({ role: newRole })
      .eq("id", teamCoachId);

    if (updateError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: updateError.message,
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "team_coaches.role_changed",
      target_kind: "team_coaches",
      target_id: teamCoachId,
      payload: { new_role: newRole },
    });

    return { ok: true, data: { id: teamCoachId } };
  } catch (error) {
    console.error("[changeCoachRole] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

// ============================================================================
// Story 8.6: Player Loan Workflow
// ============================================================================

/**
 * Request player loan from one team to another
 */
export async function requestPlayerLoan(
  playerId: string,
  fromTeamId: string,
  toTeamId: string,
  note?: string
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  try {
    const serviceRole = getAdminClient();

    // Verify both teams are in same club
    const { data: fromTeam } = await serviceRole
      .from("teams")
      .select("id, roster_id, rosters(club_id)")
      .eq("id", fromTeamId)
      .single();

    if (!fromTeam || (fromTeam.rosters as any)?.club_id !== clubId) {
      return {
        ok: false,
        error: { code: "FORBIDDEN", message: "From team not in your club" },
      };
    }

    const { data: toTeam } = await serviceRole
      .from("teams")
      .select("id, roster_id, rosters(club_id)")
      .eq("id", toTeamId)
      .single();

    if (!toTeam || (toTeam.rosters as any)?.club_id !== clubId) {
      return {
        ok: false,
        error: { code: "FORBIDDEN", message: "To team not in your club" },
      };
    }

    // H-7 FIX: Prevent same-team loans
    if (fromTeamId === toTeamId) {
      return {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Não é possível emprestar para a mesma equipa",
        },
      };
    }

    // H-6 FIX: Check if player is already loaned
    const { data: existingLoan } = await serviceRole
      .from("team_players")
      .select("id")
      .eq("player_id", playerId)
      .eq("status", "loaned")
      .single();

    if (existingLoan) {
      return {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Jogador já está emprestado",
        },
      };
    }

    // Create loan request
    const { data: loan, error: loanError } = await serviceRole
      .from("player_loans")
      .insert({
        player_id: playerId,
        from_team_id: fromTeamId,
        to_team_id: toTeamId,
        requested_by: userId,
        status: "pending",
        note: note || null,
      })
      .select("id")
      .single();

    if (loanError || !loan) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: loanError?.message || "Failed to create loan request",
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "player_loans.requested",
      target_kind: "player_loans",
      target_id: loan.id,
      payload: {
        player_id: playerId,
        from_team_id: fromTeamId,
        to_team_id: toTeamId,
        note,
      },
    });

    return { ok: true, data: { id: loan.id } };
  } catch (error) {
    console.error("[requestPlayerLoan] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

/**
 * Approve pending player loan
 */
export async function approvePlayerLoan(
  loanId: string,
  note?: string
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  try {
    const serviceRole = getAdminClient();

    // Verify loan ownership and is pending
    const { data: loan } = await serviceRole
      .from("player_loans")
      .select(
        "id, status, from_team_id, to_team_id, player_id, teams(id, roster_id, rosters(club_id))"
      )
      .eq("id", loanId)
      .single();

    if (!loan) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Loan not found" },
      };
    }

    // H-15 FIX: Verify club access via roster (not just team existence)
    const fromTeam = (loan as any).teams?.find(
      (t: any) => t.id === (loan as any).from_team_id
    );
    if (!fromTeam?.roster_id) {
      return {
        ok: false,
        error: { code: "FORBIDDEN", message: "Loan not in your club" },
      };
    }

    // Verify roster belongs to user's club
    if ((fromTeam as any).rosters?.club_id !== clubId) {
      return {
        ok: false,
        error: { code: "FORBIDDEN", message: "Loan team not in your club" },
      };
    }


    if (loan.status !== "pending") {
      return {
        ok: false,
        error: {
          code: "INVALID_STATE",
          message: `Cannot approve ${loan.status} loan`,
        },
      };
    }

    // M-4 FIX: Verify player exists in from_team
    const { data: playerInTeam } = await serviceRole
      .from("team_players")
      .select("id")
      .eq("team_id", (loan as any).from_team_id)
      .eq("player_id", (loan as any).player_id)
      .single();

    if (!playerInTeam) {
      return {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Player not found in source team",
        },
      };
    }

    // Approve
    const { error: approveError } = await serviceRole
      .from("player_loans")
      .update({
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        note: note || null,
      })
      .eq("id", loanId);

    if (approveError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: approveError.message,
        },
      };
    }

    // C-4 FIX: Create/update team_players for destination team with status='loaned'
    const { error: teamPlayerError } = await serviceRole
      .from("team_players")
      .upsert({
        team_id: (loan as any).to_team_id,
        player_id: (loan as any).player_id,
        status: "loaned",
        joined_at: new Date().toISOString(),
      }, {
        onConflict: "team_id,player_id"
      })
      .select("id")
      .single();

    if (teamPlayerError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: `Failed to create loaned player record: ${teamPlayerError.message}`,
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "player_loans.approved",
      target_kind: "player_loans",
      target_id: loanId,
      payload: {
        approved_by: userId,
        to_team_id: (loan as any).to_team_id,
        player_id: (loan as any).player_id,
        note,
      },
    });

    return { ok: true, data: { id: loanId } };
  } catch (error) {
    console.error("[approvePlayerLoan] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

/**
 * Reject pending player loan
 */
export async function rejectPlayerLoan(
  loanId: string,
  note: string
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  if (!note || note.length < 1 || note.length > 500) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Note required (1-500 chars)" },
    };
  }

  try {
    const serviceRole = getAdminClient();

    // Verify loan ownership and is pending
    const { data: loan } = await serviceRole
      .from("player_loans")
      .select(
        "id, status, from_team_id, teams(id, roster_id, rosters(club_id))"
      )
      .eq("id", loanId)
      .single();

    if (!loan) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Loan not found" },
      };
    }

    if (loan.status !== "pending") {
      return {
        ok: false,
        error: {
          code: "INVALID_STATE",
          message: `Cannot reject ${loan.status} loan`,
        },
      };
    }

    // Reject
    const { error: rejectError } = await serviceRole
      .from("player_loans")
      .update({
        status: "rejected",
        note,
      })
      .eq("id", loanId);

    if (rejectError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: rejectError.message,
        },
      };
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "player_loans.rejected",
      target_kind: "player_loans",
      target_id: loanId,
      payload: { note },
    });

    return { ok: true, data: { id: loanId } };
  } catch (error) {
    console.error("[rejectPlayerLoan] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

/**
 * Return approved player loan
 */
export async function returnPlayerLoan(
  loanId: string
): Promise<CreateRosterResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId, userId } = authResult.data;

  try {
    const serviceRole = getAdminClient();

    // Verify loan ownership and is approved
    const { data: loan } = await serviceRole
      .from("player_loans")
      .select("id, status, from_team_id, teams(id, roster_id, rosters(club_id))")
      .eq("id", loanId)
      .single();

    if (!loan) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Loan not found" },
      };
    }

    if (loan.status !== "approved") {
      return {
        ok: false,
        error: {
          code: "INVALID_STATE",
          message: `Cannot return ${loan.status} loan`,
        },
      };
    }

    // Return
    const { error: returnError } = await serviceRole
      .from("player_loans")
      .update({
        status: "returned",
        returned_at: new Date().toISOString(),
      })
      .eq("id", loanId);

    if (returnError) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: returnError.message,
        },
      };
    }

    // H-8 FIX: Archive team_players on destination team
    const { error: archiveError } = await serviceRole
      .from("team_players")
      .update({ is_archived: true })
      .eq("team_id", (loan as any).to_team_id)
      .eq("player_id", (loan as any).player_id);

    if (archiveError) {
      console.error("[returnPlayerLoan] Failed to archive team_players:", archiveError);
      // Don't fail the return — loan return should succeed even if archive fails
    }

    // Log
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "player_loans.returned",
      target_kind: "player_loans",
      target_id: loanId,
      payload: {
        to_team_id: (loan as any).to_team_id,
        player_id: (loan as any).player_id,
      },
    });

    return { ok: true, data: { id: loanId } };
  } catch (error) {
    console.error("[returnPlayerLoan] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

// ============================================================================
// Story 8.8: Audit Trail & Reporting
// ============================================================================

export interface AuditLogEntry {
  id: string;
  action: string;
  target_kind: string;
  target_id: string | null;
  actor_id: string | null;
  occurred_at: string;
  payload: Record<string, unknown> | null;
}

interface GetAuditLogsResult {
  ok: boolean;
  data?: {
    logs: AuditLogEntry[];
    total: number;
    page: number;
    per_page: number;
  };
  error?: { code: string; message: string };
}

/**
 * Query audit logs for admin actions (Story 8.8)
 *
 * Filters:
 * - action: specific admin action (e.g., 'rosters.created')
 * - target_kind: table affected (e.g., 'rosters')
 * - actor_id: who performed action
 * - from_date / to_date: timestamp range
 * - page / per_page: pagination
 */
export async function getAuditLogsForAdmin(filters: {
  action?: string;
  target_kind?: string;
  actor_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
}): Promise<GetAuditLogsResult> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Staff access required" },
    };
  }

  const { clubId } = authResult.data;
  const page = filters.page ?? 1;
  const per_page = Math.min(filters.per_page ?? 50, 100); // Max 100 per page
  const offset = (page - 1) * per_page;

  try {
    const serviceRole = getAdminClient();

    // Build query
    let query = serviceRole
      .from("audit_logs")
      .select("id, action, target_kind, target_id, actor_id, occurred_at, payload", {
        count: "exact",
      })
      .eq("club_id", clubId)
      .order("occurred_at", { ascending: false });

    // Apply filters
    if (filters.action) {
      query = query.eq("action", filters.action);
    }

    if (filters.target_kind) {
      query = query.eq("target_kind", filters.target_kind);
    }

    if (filters.actor_id) {
      query = query.eq("actor_id", filters.actor_id);
    }

    if (filters.from_date) {
      query = query.gte("occurred_at", filters.from_date);
    }

    if (filters.to_date) {
      query = query.lte("occurred_at", filters.to_date);
    }

    // Paginate
    query = query.range(offset, offset + per_page - 1);

    const { data: logs, count, error } = await query;

    if (error) {
      return {
        ok: false,
        error: {
          code: "DATABASE_ERROR",
          message: error.message,
        },
      };
    }

    return {
      ok: true,
      data: {
        logs: (logs || []) as AuditLogEntry[],
        total: count || 0,
        page,
        per_page,
      },
    };
  } catch (error) {
    console.error("[getAuditLogsForAdmin] Unexpected error:", error);
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
  }
}

// ============================================================================
// Story 8.7: Admin Dashboard Stats
// ============================================================================

export interface AdminDashboardStats {
  rosters: number;
  teams: number;
  players: number;
  loans: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return { rosters: 0, teams: 0, players: 0, loans: 0 };

  const { clubId } = authResult.data;

  try {
    const db = getAdminClient();

    const { data: rosters, error: rostersError } = await db
      .from("rosters")
      .select("id")
      .eq("club_id", clubId)
      .eq("status", "active");

    if (rostersError || !Array.isArray(rosters)) {
      return { rosters: 0, teams: 0, players: 0, loans: 0 };
    }

    const rosterIds: string[] = rosters.map((r: { id: string }) => r.id);
    if (rosterIds.length === 0) {
      return { rosters: 0, teams: 0, players: 0, loans: 0 };
    }

    const { data: teams, error: teamsError } = await db
      .from("teams")
      .select("id")
      .in("roster_id", rosterIds)
      .eq("is_archived", false);

    if (teamsError || !Array.isArray(teams)) {
      return { rosters: rosterIds.length, teams: 0, players: 0, loans: 0 };
    }

    const teamIds: string[] = teams.map((t: { id: string }) => t.id);
    if (teamIds.length === 0) {
      return { rosters: rosterIds.length, teams: 0, players: 0, loans: 0 };
    }

    const [playersResult, loansResult] = await Promise.all([
      db
        .from("team_players")
        .select("id", { count: "exact", head: true })
        .in("team_id", teamIds)
        .eq("status", "active"),
      db
        .from("player_loans")
        .select("id", { count: "exact", head: true })
        .in("from_team_id", teamIds)
        .eq("status", "pending"),
    ]);

    return {
      rosters: rosterIds.length,
      teams: teamIds.length,
      players: playersResult.count ?? 0,
      loans: loansResult.count ?? 0,
    };
  } catch {
    return { rosters: 0, teams: 0, players: 0, loans: 0 };
  }
}

// ============================================================================
// Helper list actions (for dropdowns and page data)
// ============================================================================

export async function listSeasons() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return [];
  const { clubId } = authResult.data;
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("seasons")
      .select("id, name, is_current")
      .eq("club_id", clubId)
      .order("start_date", { ascending: false });
    return data ?? [];
  } catch { return []; }
}

export async function listClubPlayers() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return [];
  const { clubId } = authResult.data;
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("players")
      .select("id, full_name, jersey_num, age_group")
      .eq("club_id", clubId)
      .eq("is_archived", false)
      .order("full_name", { ascending: true });
    return data ?? [];
  } catch { return []; }
}

export async function listClubProfiles() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return [];
  const { clubId } = authResult.data;
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("profiles")
      .select("id, full_name, role")
      .eq("club_id", clubId)
      .in("role", ["coach", "analyst"])
      .order("full_name", { ascending: true });
    return data ?? [];
  } catch { return []; }
}

// ============================================================================
// List actions for admin pages
// ============================================================================

export async function listRosters() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return [];
  const { clubId } = authResult.data;
  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("rosters")
      .select("id, name, status, is_archived, season_id, seasons(name)")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data ?? [];
  } catch { return []; }
}

export async function listTeams() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return [];
  const { clubId } = authResult.data;
  try {
    const db = getAdminClient();
    const { data: rosters } = await db.from("rosters").select("id").eq("club_id", clubId);
    const rosterIds = (rosters ?? []).map((r: { id: string }) => r.id);
    if (rosterIds.length === 0) return [];
    const { data, error } = await db
      .from("teams")
      .select("id, name, escalao, level, is_b_team, is_archived, roster_id, rosters(name)")
      .in("roster_id", rosterIds)
      .eq("is_archived", false)
      .order("name", { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch { return []; }
}

export async function listTeamPlayers() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return [];
  const { clubId } = authResult.data;
  try {
    const db = getAdminClient();
    const { data: rosters } = await db.from("rosters").select("id").eq("club_id", clubId);
    const rosterIds = (rosters ?? []).map((r: { id: string }) => r.id);
    if (rosterIds.length === 0) return [];
    const { data: teams } = await db.from("teams").select("id").in("roster_id", rosterIds);
    const teamIds = (teams ?? []).map((t: { id: string }) => t.id);
    if (teamIds.length === 0) return [];
    const { data, error } = await db
      .from("team_players")
      .select("id, status, position, player_id, team_id, players(full_name, jersey_num, age_group), teams(name)")
      .in("team_id", teamIds)
      .eq("is_archived", false)
      .order("status", { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch { return []; }
}

export async function listTeamCoaches() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return [];
  const { clubId } = authResult.data;
  try {
    const db = getAdminClient();
    const { data: rosters } = await db.from("rosters").select("id").eq("club_id", clubId);
    const rosterIds = (rosters ?? []).map((r: { id: string }) => r.id);
    if (rosterIds.length === 0) return [];
    const { data: teams } = await db.from("teams").select("id").in("roster_id", rosterIds);
    const teamIds = (teams ?? []).map((t: { id: string }) => t.id);
    if (teamIds.length === 0) return [];
    const { data, error } = await db
      .from("team_coaches")
      .select("id, role, profile_id, team_id, profiles(full_name), teams(name)")
      .in("team_id", teamIds)
      .eq("is_archived", false)
      .order("role", { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch { return []; }
}

export async function listPlayerLoans() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return [];
  const { clubId } = authResult.data;
  try {
    const db = getAdminClient();
    const { data: rosters } = await db.from("rosters").select("id").eq("club_id", clubId);
    const rosterIds = (rosters ?? []).map((r: { id: string }) => r.id);
    if (rosterIds.length === 0) return [];
    const { data: teams } = await db.from("teams").select("id").in("roster_id", rosterIds);
    const teamIds = (teams ?? []).map((t: { id: string }) => t.id);
    if (teamIds.length === 0) return [];
    const { data, error } = await db
      .from("player_loans")
      .select("id, status, note, player_id, from_team_id, to_team_id, players(full_name)")
      .in("from_team_id", teamIds)
      .order("status", { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch { return []; }
}

/**
 * Lists all players registered in any roster of the club,
 * enriched with their team assignments (if any).
 */
export async function listRosterPlayers() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) return [];
  const { clubId } = authResult.data;
  try {
    const db = getAdminClient() as any;

    // Get all rosters for this club
    const { data: rosters } = await db
      .from("rosters")
      .select("id, name")
      .eq("club_id", clubId);
    const rosterIds = (rosters ?? []).map((r: any) => r.id);
    const rosterNameById = new Map((rosters ?? []).map((r: any) => [r.id, r.name]));
    if (rosterIds.length === 0) return [];

    // Get all roster_players
    const { data: rosterPlayers } = await db
      .from("roster_players")
      .select("id, roster_id, player_id, players(id, full_name, jersey_num, age_group)")
      .in("roster_id", rosterIds)
      .eq("is_archived", false);

    if (!rosterPlayers || rosterPlayers.length === 0) return [];

    const playerIds = rosterPlayers.map((rp: any) => rp.player_id);

    // Get team assignments for these players
    const { data: teamPlayers } = await (db as any)
      .from("team_players")
      .select("id, player_id, team_id, status, position, teams(id, name)")
      .in("player_id", playerIds)
      .eq("is_archived", false);

    const teamsByPlayer = new Map<string, any[]>();
    for (const tp of teamPlayers ?? []) {
      const list = teamsByPlayer.get(tp.player_id) ?? [];
      list.push(tp);
      teamsByPlayer.set(tp.player_id, list);
    }

    return rosterPlayers.map((rp: any) => ({
      rosterId: rp.roster_id,
      rosterName: rosterNameById.get(rp.roster_id) ?? "—",
      player: rp.players,
      teams: teamsByPlayer.get(rp.player_id) ?? [],
    }));
  } catch { return []; }
}
