"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logAccess } from "@/lib/actions/audit";
import { requireStaffRole } from "@/lib/actions/auth";
import { refreshSnapshotForSession } from "@/lib/readiness/snapshot";
import { newId } from "@/lib/uuid";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { logger } from "@/lib/logger";
import {
  ATTENDANCE_STATUSES,
  UpsertAttendanceInputSchema,
  type AttendanceRecord,
  type PlayerForAttendance,
} from "@/lib/schemas/attendances";

export async function getPlayersForAttendance(
  sessionId: string
): Promise<Result<PlayerForAttendance[], AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: players, error: playersError } = await serviceRole
    .from("players")
    .select("id, full_name, jersey_num, is_active")
    .eq("club_id", clubId)
    .eq("is_archived", false)
    .order("full_name");

  if (playersError) {
    return err({ code: "db_error", message: playersError.message });
  }

  const playerList = players ?? [];

  if (playerList.length === 0) {
    return ok([]);
  }

  const playerIds = playerList.map((p) => p.id);

  const { data: positions, error: posError } = await serviceRole
    .from("positions")
    .select("player_id, position")
    .in("player_id", playerIds)
    .eq("is_primary", true);

  if (posError) {
    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "attendance.get_positions_failed",
        session_id: sessionId,
        error: posError.message,
      })
    );
  }

  const posMap = new Map(
    (positions ?? []).map((p) => [p.player_id, p.position])
  );

  return ok(
    playerList.map((p) => ({
      id: p.id,
      full_name: p.full_name,
      jersey_num: p.jersey_num ?? 0,
      primary_position: posMap.get(p.id) ?? null,
      is_active: p.is_active ?? true,
    }))
  );
}

export async function getSessionAttendances(
  sessionId: string
): Promise<Result<AttendanceRecord[], AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data, error } = await serviceRole
    .from("attendances")
    .select("player_id, status, note, recorded_at")
    .eq("session_id", sessionId)
    .eq("club_id", clubId);

  if (error) {
    return err({ code: "db_error", message: error.message });
  }

  return ok(
    (data ?? [])
      .map((r) => {
        const statusParsed = ATTENDANCE_STATUSES.find((s) => s === r.status);
        if (!statusParsed) {
          return null;
        }
        return {
          player_id: r.player_id,
          status: statusParsed,
          note: r.note ?? null,
          recorded_at: r.recorded_at,
        };
      })
      .filter((r) => r !== null)
  );
}

/**
 * refreshAttendanceForSession — Sincroniza presenças com questionários submetidos.
 *
 * Parte dos questionários pré-sessão submetidos (fonte de verdade):
 * - Se o jogador tem registo 'sem_questionario' → actualiza para 'present'
 * - Se o jogador não tem registo de presença → cria com 'present'
 * - Outros estados (absent, late, etc.) não são alterados (decisão do staff)
 * Retorna todos os registos de presença actualizados para a sessão.
 *
 * Usado pelo botão ↻ no painel de presenças.
 */
export async function refreshAttendanceForSession(
  sessionId: string
): Promise<Result<AttendanceRecord[], AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  // 1. Get ALL players who submitted the pre-questionnaire for this session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, custom/no-direct-health-data-read -- service role, staff-only action, requireStaffRole() guard above
  const { data: preResponses } = await (serviceRole as any)
    .from("fatigue_responses")
    .select("player_id")
    .eq("session_id", sessionId)
    .eq("club_id", clubId)
    .eq("phase", "pre");

  const respondedIds: string[] = (preResponses ?? []).map(
    (r: { player_id: string }) => r.player_id
  );

  if (respondedIds.length > 0) {
    // 2. Check which of those already have an attendance record
    const { data: existing } = await serviceRole
      .from("attendances")
      .select("player_id, status")
      .eq("session_id", sessionId)
      .eq("club_id", clubId)
      .in("player_id", respondedIds);

    const existingMap = new Map(
      (existing ?? []).map((r) => [r.player_id as string, r.status as string])
    );

    // 3a. Update sem_questionario → present for players with a record
    const toUpdate = respondedIds.filter(
      (id) => existingMap.get(id) === "sem_questionario"
    );
    if (toUpdate.length > 0) {
      await serviceRole
        .from("attendances")
        .update({ status: "present" })
        .eq("session_id", sessionId)
        .eq("club_id", clubId)
        .eq("status", "sem_questionario")
        .in("player_id", toUpdate);
    }

    // 3b. Create present records for players with no attendance record yet
    const toCreate = respondedIds.filter((id) => !existingMap.has(id));
    if (toCreate.length > 0) {
      await serviceRole.from("attendances").insert(
        toCreate.map((playerId) => ({
          id: newId(),
          club_id: clubId,
          session_id: sessionId,
          player_id: playerId,
          status: "present",
          note: null,
          recorded_by: userId,
        }))
      );
    }
  }

  // 4. Return all attendance records for the session
  const { data, error } = await serviceRole
    .from("attendances")
    .select("player_id, status, note, recorded_at")
    .eq("session_id", sessionId)
    .eq("club_id", clubId);

  if (error) return err({ code: "db_error", message: error.message });

  return ok(
    (data ?? [])
      .map((r) => {
        const statusParsed = ATTENDANCE_STATUSES.find((s) => s === r.status);
        if (!statusParsed) return null;
        return {
          player_id: r.player_id,
          status: statusParsed,
          note: r.note ?? null,
          recorded_at: r.recorded_at,
        };
      })
      .filter((r) => r !== null)
  );
}

export async function upsertAttendance(
  input: unknown
): Promise<Result<void, AppError>> {
  const validated = UpsertAttendanceInputSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "validation",
      message:
        validated.error.issues[0]?.message ?? "Dados de presença inválidos",
    });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: session } = await serviceRole
    .from("sessions")
    .select("id, club_id")
    .eq("id", validated.data.session_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) {
    return err({ code: "not_found", message: "Sessão não encontrada" });
  }

  const { error: upsertError } = await serviceRole
    .from("attendances")
    .upsert(
      {
        id: validated.data.id,
        session_id: validated.data.session_id,
        player_id: validated.data.player_id,
        status: validated.data.status,
        note: validated.data.note ?? null,
        club_id: clubId,
        recorded_by: userId,
        recorded_at: new Date().toISOString(),
      },
      {
        onConflict: "session_id,player_id",
        ignoreDuplicates: false,
        // NOTE: On conflict, DO NOT update recorded_at — preserve audit trail.
        // Only status, note, and recorded_by are updated. This ensures idempotency:
        // calling upsertAttendance twice with same (session_id, player_id) preserves
        // the original "when" the record was first created.
      }
    );

  if (upsertError) {
    return err({ code: "db_error", message: upsertError.message });
  }

  void logAccess("attendance.recorded", "session", validated.data.session_id, {
    player_id: validated.data.player_id,
    status: validated.data.status,
  });

  void (async () => {
    try {
      await refreshSnapshotForSession(serviceRole, validated.data.session_id);
    } catch (e) {
      logger.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          message: "attendance.readiness_refresh_failed",
          session_id: validated.data.session_id,
          error: e instanceof Error ? e.message : String(e),
        })
      );
    }
  })();

  return ok(undefined);
}
