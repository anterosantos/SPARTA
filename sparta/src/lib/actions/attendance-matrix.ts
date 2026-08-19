"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffRole, getPlayerIdsForTeams } from "@/lib/actions/auth";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/schemas/attendances";
import { attendanceMatrixKey } from "@/lib/attendance-status";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

const EIGHT_WEEKS_MS = 8 * 7 * 24 * 60 * 60 * 1000;

/** Mesma ordem de grupo já usada em attendance-panel.tsx (GK/DEF/MID/FWD). */
const POSITION_ORDER: Record<string, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
};

export interface AttendanceMatrixPlayer {
  id: string;
  fullName: string;
  jerseyNum: number | null;
  position: string | null;
}

export interface AttendanceMatrixSession {
  id: string;
  type: string;
  scheduledAt: string;
}

export interface AttendanceMatrixData {
  players: AttendanceMatrixPlayer[];
  sessions: AttendanceMatrixSession[];
  statusMap: Record<string, AttendanceStatus>;
}

export async function getAttendanceMatrixData(): Promise<
  Result<AttendanceMatrixData, AppError>
> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId, teamIds } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const playerIds = await getPlayerIdsForTeams(teamIds);
  if (playerIds.length === 0) {
    return ok({ players: [], sessions: [], statusMap: {} });
  }

  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - EIGHT_WEEKS_MS);

  // Jogadores + posição primária e sessões não dependem uma da outra — buscar em paralelo.
  const [playersRes, posRes, sessionsResult] = await Promise.all([
    serviceRole
      .from("players")
      .select("id, full_name, jersey_num")
      .in("id", playerIds)
      .eq("club_id", clubId)
      .is("archived_at", null),
    serviceRole
      .from("positions")
      .select("player_id, position")
      .in("player_id", playerIds)
      .eq("is_primary", true),
    getSessionsForClub({
      from: eightWeeksAgo.toISOString(),
      to: now.toISOString(),
    }),
  ]);

  if (playersRes.error) {
    return err({
      code: "db_error",
      message: playersRes.error.message ?? "Erro ao carregar jogadores",
    });
  }
  if (posRes.error) {
    return err({
      code: "db_error",
      message: posRes.error.message ?? "Erro ao carregar posições dos jogadores",
    });
  }
  if (!sessionsResult.ok) return sessionsResult;

  const positionMap = new Map<string, string>();
  for (const pos of posRes.data ?? []) {
    if (pos?.player_id && pos.position) {
      positionMap.set(pos.player_id, pos.position);
    }
  }

  const players: AttendanceMatrixPlayer[] = (playersRes.data ?? [])
    .map((p) => ({
      id: p.id,
      fullName: p.full_name?.trim() || "—",
      jerseyNum: p.jersey_num ?? null,
      position: positionMap.get(p.id) ?? null,
    }))
    .sort((a, b) => {
      // Posição (GK/DEF/MID/FWD, desconhecida/nula por último), depois dorsal ascendente
      // (nulo por último), depois nome como desempate determinístico.
      const posA = a.position ? (POSITION_ORDER[a.position] ?? 99) : 99;
      const posB = b.position ? (POSITION_ORDER[b.position] ?? 99) : 99;
      if (posA !== posB) return posA - posB;

      if (a.jerseyNum === null && b.jerseyNum !== null) return 1;
      if (a.jerseyNum !== null && b.jerseyNum === null) return -1;
      if (a.jerseyNum !== null && b.jerseyNum !== null && a.jerseyNum !== b.jerseyNum) {
        return a.jerseyNum - b.jerseyNum;
      }

      return a.fullName.localeCompare(b.fullName, "pt-PT");
    });

  const sessions: AttendanceMatrixSession[] = sessionsResult.data
    .map((s) => ({
      id: s.id,
      type: s.type,
      scheduledAt: s.scheduled_at,
    }))
    .sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

  const statusMap: Record<string, AttendanceStatus> = {};

  if (players.length > 0 && sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id);
    const { data: attendanceRows, error: attendanceError } = await serviceRole
      .from("attendances")
      .select("player_id, session_id, status")
      .eq("club_id", clubId)
      .in("player_id", playerIds)
      .in("session_id", sessionIds);
    if (attendanceError) {
      return err({
        code: "db_error",
        message: attendanceError.message ?? "Erro ao carregar presenças",
      });
    }
    for (const row of attendanceRows ?? []) {
      if (!row.player_id || !row.session_id) continue;
      const statusParsed = ATTENDANCE_STATUSES.find((s) => s === row.status);
      if (!statusParsed) continue;
      statusMap[attendanceMatrixKey(row.player_id, row.session_id)] = statusParsed;
    }
  }

  return ok({ players, sessions, statusMap });
}
