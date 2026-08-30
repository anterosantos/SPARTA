"use server";

import { z } from "zod";
import { getRequestUser } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffRole } from "@/lib/actions/auth";
import { logAccess } from "@/lib/actions/audit";
import type { Result, AppError } from "@/lib/types";
import { ok, err } from "@/lib/types";

// Convocatória agora só define QUEM está convocado — sem distinção titular/suplente.
// Os titulares só são escolhidos no início da captura de eventos (setStartingLineup),
// altura em que faz sentido saber quem realmente vai a jogo.
const PlayersArraySchema = z
  .array(
    z.object({
      playerId: z.string().uuid("ID de jogador inválido"),
      shirtNum: z
        .number()
        .int("Número de camisola inválido")
        .positive("Número de camisola tem de ser entre 1 e 99")
        .max(99, "Número de camisola tem de ser entre 1 e 99")
        .nullable()
        .optional(),
    })
  )
  .min(1, "Pelo menos um jogador é necessário");

const ConvocatoriaFieldsSchema = z.object({
  concentrationTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato inválido (HH:MM)")
    .nullable()
    .optional(),
  opponentName: z.string().max(100).nullable().optional(),
});

const SubmitLineupSchema = z.object({
  sessionId: z.string().uuid("ID de sessão inválido"),
  players: PlayersArraySchema,
}).merge(ConvocatoriaFieldsSchema);

const SendConvocatoriaSchema = z.object({
  sessionId: z.string().uuid("ID de sessão inválido"),
  players: PlayersArraySchema,
}).merge(ConvocatoriaFieldsSchema);

export interface SubmitLineupResult {
  ok: boolean;
  error?: string;
}

// In-memory lock to prevent concurrent submissions for the same session
const submissionLocks = new Map<string, Promise<void>>();

export async function submitLineup(
  input: unknown
): Promise<SubmitLineupResult> {
  // Validate input
  const validated = SubmitLineupSchema.safeParse(input);
  if (!validated.success) {
    const message = validated.error.issues[0]?.message || "Dados inválidos";
    return { ok: false, error: message };
  }

  const { sessionId, players, concentrationTime, opponentName } = validated.data;

  const { supabase, user, profile } = await getRequestUser();
  if (!user) {
    return { ok: false, error: "Não autenticado" };
  }
  if (!profile?.club_id) {
    return { ok: false, error: "Perfil não encontrado" };
  }

  // Verify user is a coach (only coaches can submit lineups)
  if (profile.role !== "coach") {
    return { ok: false, error: "Apenas treinadores podem submeter convocatórias" };
  }

  // Prevent concurrent submissions for the same session
  if (submissionLocks.has(sessionId)) {
    return { ok: false, error: "Submissão em progresso. Por favor aguarde." };
  }

  // Create a lock promise for this session
  const lockPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      submissionLocks.delete(sessionId);
      resolve();
    }, 5000); // 5s timeout to release lock
  });

  submissionLocks.set(sessionId, lockPromise);

  // Verify session belongs to user's club
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, club_id, type")
    .eq("id", sessionId)
    .eq("club_id", profile.club_id)
    .single();

  if (sessionError) {
    console.error("[submitLineup] Session fetch error:", sessionError);
    return { ok: false, error: `Sessão não encontrada: ${sessionError.message}` };
  }

  if (!session) {
    return {
      ok: false,
      error: `Sessão ${sessionId} não encontrada no clube ${profile.club_id}`,
    };
  }

  // Verify session type is match or friendly (not training) — server-side enforcement
  const validSessionTypes = ["match", "friendly"];
  if (!validSessionTypes.includes(session.type)) {
    return { ok: false, error: "Convocatória apenas para jogos e amigáveis" };
  }

  // Verify all players belong to the club
  const playerIds = players.map((p) => p.playerId);
  const playersResult = await supabase
    .from("players")
    .select("id, club_id")
    .in("id", playerIds)
    .eq("club_id", profile.club_id);
  const { data: clubPlayers, error: playersError } = playersResult as {
    data: Array<{
      id: string;
      club_id: string;
    }> | null;
    error: { message: string } | null;
  };

  if (playersError) {
    console.error("[submitLineup] Player validation error:", playersError.message);
    return {
      ok: false,
      error: `Erro ao validar jogadores: ${playersError.message}`,
    };
  }

  if (!clubPlayers || clubPlayers.length !== playerIds.length) {
    const found = clubPlayers?.length ?? 0;
    console.warn(
      `[submitLineup] Found ${found}/${playerIds.length} players in club ${profile.club_id}`
    );
    return {
      ok: false,
      error: `${found}/${playerIds.length} jogadores encontrados. Verifique se pertencem ao seu clube.`,
    };
  }

  // Delete existing lineups and insert new ones in a single RPC call for atomicity
  // Note: match_lineups table added in migration 000130; using type assertion
  // Convocatória grava sempre "convocado_only" — titular/suplente só é decidido
  // depois, em setStartingLineup() no início da captura de eventos.
  const lineupInserts = players.map((player) => ({
    session_id: sessionId,
    player_id: player.playerId,
    role: "convocado_only" as const,
    shirt_num: player.shirtNum ?? null,
    started_minute: 0,
  }));

  // Delete existing lineups and insert new ones
  // Note: match_lineups table added in migration 000130; not yet in Supabase client types
  try {
    // Delete previous lineups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchLineupTable = (supabase.from as any)("match_lineups");
    const deleteResult = await matchLineupTable
      .delete()
      .eq("session_id", sessionId);

    if (deleteResult.error) {
      console.error("[submitLineup] Delete error:", deleteResult.error);
      return {
        ok: false,
        error: `Delete failed: ${deleteResult.error.message}`,
      };
    }

    // Insert new lineups
    const insertResult = await matchLineupTable.insert(
      lineupInserts.map((l) => ({
        ...l,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
    );

    if (insertResult.error) {
      console.error("[submitLineup] Insert error:", insertResult.error);
      return {
        ok: false,
        error: `Insert failed: ${insertResult.error.message}`,
      };
    }
  } catch (err) {
    console.error("[submitLineup] Operation error:", err);
    return {
      ok: false,
      error: `Operation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }

  // Save concentration_time and opponent_name to session if provided
  if (concentrationTime !== undefined || opponentName !== undefined) {
    const sessionPatch = {
      ...(concentrationTime !== undefined && { concentration_time: concentrationTime ?? null }),
      ...(opponentName !== undefined && { opponent_name: opponentName ?? null }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("sessions").update(sessionPatch as any).eq("id", sessionId);
  }

  // Create audit log entry
  try {
    await logAccess("lineup.submitted", "session", sessionId);
  } catch (logError) {
    console.error("[submitLineup] Audit log failed:", logError);
    // Continue anyway - audit log failure shouldn't block the main operation
  }

  return { ok: true };
}

export interface MatchLineupData {
  id: string;
  session_id: string;
  player_id: string;
  role: "starter" | "bench" | "convocado_only";
  shirt_num: number | null;
  started_minute: number;
  ended_minute: number | null;
  created_at: string;
  updated_at: string;
}

export interface MatchLineupWithPlayerData extends MatchLineupData {
  name: string;
  jersey_number: number;
  position: string;
  age_group: string;
  processing_restricted: boolean;
}

// Fetch existing lineups for a session with player details (for loading in the UI)
export async function getLineupForSession(
  sessionId: string
): Promise<Result<MatchLineupWithPlayerData[], AppError>> {
  const { supabase, user, profile } = await getRequestUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  const AGE_GROUP_DISPLAY: Record<string, string> = {
    u14: "U-14", u15: "U-15", u17: "U-17", u19: "U-19", senior: "Senior",
  };

  // Fetch starters with player details (full_name, jersey_num, age_group, processing_restricted)
  // and their primary position from the positions table.
  // Club isolation is enforced by page.tsx + RLS.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchLineupTable = (supabase.from as any)("match_lineups");
  const selectResult = await matchLineupTable
    .select(
      `*,
       players(full_name, jersey_num, age_group, processing_restricted, positions(position, is_primary))`
    )
    .eq("session_id", sessionId);
  const { data: lineupData, error } = selectResult as {
    data: Array<{
      id: string;
      session_id: string;
      player_id: string;
      role: string;
      shirt_num: number | null;
      started_minute: number;
      ended_minute: number | null;
      created_at: string;
      updated_at: string;
      players: {
        full_name: string;
        jersey_num: number;
        age_group: string;
        processing_restricted: boolean;
        positions: Array<{ position: string; is_primary: boolean }> | null;
      } | null;
    }> | null;
    error: { message: string } | null;
  };

  if (error) {
    return err({ code: "unknown", message: error.message });
  }

  if (!lineupData) {
    return ok([]);
  }

  const lineups: MatchLineupWithPlayerData[] = lineupData
    .filter((l) => l.players !== null)
    .map((l) => {
      const p = l.players!;
      const primaryPos =
        p.positions?.find((pos) => pos.is_primary)?.position ??
        p.positions?.[0]?.position ??
        "—";
      return {
        id: l.id,
        session_id: l.session_id,
        player_id: l.player_id,
        role: l.role as "starter" | "bench" | "convocado_only",
        shirt_num: l.shirt_num,
        started_minute: l.started_minute,
        ended_minute: l.ended_minute,
        created_at: l.created_at,
        updated_at: l.updated_at,
        name: p.full_name,
        jersey_number: l.shirt_num ?? p.jersey_num,
        position: primaryPos,
        age_group: AGE_GROUP_DISPLAY[p.age_group] ?? p.age_group,
        processing_restricted: p.processing_restricted === true,
      };
    });

  return ok(lineups);
}

// =============================================================================
// sendConvocatoria — guarda lineup + hora de concentração + envia push a todos
// =============================================================================

export async function sendConvocatoria(
  input: unknown
): Promise<SubmitLineupResult> {
  const validated = SendConvocatoriaSchema.safeParse(input);
  if (!validated.success) {
    const message = validated.error.issues[0]?.message || "Dados inválidos";
    return { ok: false, error: message };
  }

  const { sessionId, players, concentrationTime, opponentName } = validated.data;
  const { supabase, user, profile } = await getRequestUser();

  if (!user) return { ok: false, error: "Não autenticado" };
  if (!profile?.club_id) return { ok: false, error: "Perfil não encontrado" };
  if (profile.role !== "coach") {
    return { ok: false, error: "Apenas treinadores podem enviar convocatórias" };
  }

  // Verify session belongs to coach's club
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, club_id, type")
    .eq("id", sessionId)
    .eq("club_id", profile.club_id)
    .single();

  if (sessionError || !session) {
    return { ok: false, error: "Sessão não encontrada" };
  }
  if (!["match", "friendly"].includes(session.type)) {
    return { ok: false, error: "Convocatória apenas para jogos e amigáveis" };
  }

  // Verify all players belong to the session's assigned teams
  const playerIds = players.map((p) => p.playerId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceRole = (await import("@/lib/supabase/service-role")).getServiceRoleClient() as any;
  const { data: sessionTeamRows } = await serviceRole
    .from("session_teams")
    .select("team_id")
    .eq("session_id", sessionId);
  const sessionTeamIds: string[] = (sessionTeamRows ?? []).map((r: { team_id: string }) => r.team_id);

  if (sessionTeamIds.length > 0) {
    const { data: tpRows } = await serviceRole
      .from("team_players")
      .select("player_id")
      .in("team_id", sessionTeamIds)
      .eq("is_archived", false);
    const allowedIds = new Set((tpRows ?? []).map((r: { player_id: string }) => r.player_id));
    const invalid = playerIds.filter((id) => !allowedIds.has(id));
    if (invalid.length > 0) {
      return { ok: false, error: "Alguns jogadores não pertencem às equipas desta sessão" };
    }
  }

  const { data: clubPlayers, error: playersError } = await supabase
    .from("players")
    .select("id, profile_id")
    .in("id", playerIds)
    .eq("club_id", profile.club_id) as {
      data: Array<{ id: string; profile_id: string | null }> | null;
      error: { message: string } | null;
    };

  if (playersError || !clubPlayers || clubPlayers.length !== playerIds.length) {
    return { ok: false, error: "Jogadores inválidos ou fora do clube" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchLineupTable = (supabase.from as any)("match_lineups");

  try {
    // 1. Save concentration_time and opponent_name to session
    const sessionPatch = {
      concentration_time: concentrationTime ?? null,
      opponent_name: opponentName ?? null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("sessions").update(sessionPatch as any).eq("id", sessionId);

    // 2. Save lineup (delete + insert, same as submitLineup)
    const deleteResult = await matchLineupTable.delete().eq("session_id", sessionId);
    if (deleteResult.error) {
      return { ok: false, error: `Erro ao limpar lineup: ${deleteResult.error.message}` };
    }

    const insertResult = await matchLineupTable.insert(
      players.map((p) => ({
        session_id: sessionId,
        player_id: p.playerId,
        role: "convocado_only" as const,
        shirt_num: p.shirtNum ?? null,
        started_minute: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
    );
    if (insertResult.error) {
      return { ok: false, error: `Erro ao guardar lineup: ${insertResult.error.message}` };
    }

    // 3. Create notification_log entries for all convocados com profile_id
    const now = new Date().toISOString();
    const notifRows = clubPlayers
      .filter((p) => p.profile_id)
      .map((p) => ({
        club_id: session.club_id,
        profile_id: p.profile_id!,
        session_id: sessionId,
        kind: "convocado",
        scheduled_for: now,
        status: "scheduled",
      }));

    if (notifRows.length > 0) {
      // notification_log só tem SELECT policy para authenticated — usa service role para INSERT
      const serviceRole = getServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notifTable = (serviceRole.from as any)("notification_log");
      const upsertResult = await notifTable.upsert(notifRows, {
        onConflict: "profile_id,session_id,kind",
        ignoreDuplicates: false,
      });
      if (upsertResult.error) {
        console.error("[sendConvocatoria] notification_log upsert error:", upsertResult.error);
        return { ok: false, error: `Erro ao criar notificações: ${upsertResult.error.message}` };
      }
    }

    // 4. Marcar como enviada — só depois de tudo o resto ter sucesso. Antes disto,
    // getPlayerNotifications() não deve mostrar nada aos jogadores, mesmo que
    // match_lineups já tenha linhas (guardadas via submitLineup, "só staff").
    await supabase
      .from("sessions")
      .update({ convocatoria_sent_at: new Date().toISOString() })
      .eq("id", sessionId);

    await logAccess("convocatoria.sent", "session", sessionId);
  } catch (e) {
    console.error("[sendConvocatoria] unexpected error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }

  return { ok: true };
}

// =============================================================================
// setStartingLineup — escolhe os 11 titulares de entre os convocados, no início
// da captura de eventos (não na Convocatória). Os restantes convocados passam a
// "bench" (disponíveis para substituição via SubstitutionSheet).
// =============================================================================

const SetStartingLineupSchema = z.object({
  sessionId: z.string().uuid("ID de sessão inválido"),
  starterPlayerIds: z
    .array(z.string().uuid("ID de jogador inválido"))
    .length(11, "Deve seleccionar exactamente 11 titulares"),
});

export async function setStartingLineup(
  input: unknown
): Promise<Result<void, AppError>> {
  const validated = SetStartingLineupSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "validation",
      message: validated.error.issues[0]?.message ?? "Dados inválidos",
    });
  }
  const { sessionId, starterPlayerIds } = validated.data;

  // Staff (coach OU analyst) — a captura de eventos já é acessível a ambos, por isso
  // a escolha dos titulares também tem de ser (ao contrário de submitLineup/
  // sendConvocatoria, que continuam coach-only por serem passos de preparação).
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: session } = await serviceRole
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();
  if (!session) return err({ code: "not_found", message: "Sessão não encontrada" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchLineupTable = (serviceRole.from as any)("match_lineups");

  const { data: existingRows, error: fetchError } = await matchLineupTable
    .select("player_id")
    .eq("session_id", sessionId);
  if (fetchError) {
    return err({ code: "unknown", message: fetchError.message });
  }

  const existingIds = new Set<string>(
    (existingRows ?? []).map((r: { player_id: string }) => r.player_id)
  );
  const notConvocado = starterPlayerIds.filter((id) => !existingIds.has(id));
  if (notConvocado.length > 0) {
    return err({
      code: "validation",
      message: "Alguns titulares seleccionados não estão convocados para esta sessão",
    });
  }

  const starterSet = new Set(starterPlayerIds);

  const { error: starterError } = await matchLineupTable
    .update({ role: "starter" })
    .eq("session_id", sessionId)
    .in("player_id", starterPlayerIds);
  if (starterError) {
    return err({ code: "unknown", message: starterError.message });
  }

  const benchIds = [...existingIds].filter((id) => !starterSet.has(id));
  if (benchIds.length > 0) {
    const { error: benchError } = await matchLineupTable
      .update({ role: "bench" })
      .eq("session_id", sessionId)
      .in("player_id", benchIds);
    if (benchError) {
      return err({ code: "unknown", message: benchError.message });
    }
  }

  // Regista o período inicial em campo (minuto 0) de cada titular — necessário para
  // somar minutos jogados correctamente com substituições volantes (ver
  // match_lineup_stints, migration 000399). Só na primeira vez: se esta acção for
  // chamada de novo para a mesma sessão, não duplica o período já criado (evita
  // somar minutos a mais).
  const { data: existingStints, error: existingStintsError } = await serviceRole
    .from("match_lineup_stints")
    .select("player_id")
    .eq("session_id", sessionId);
  if (existingStintsError) {
    return err({ code: "unknown", message: existingStintsError.message });
  }
  const playersWithStint = new Set((existingStints ?? []).map((r) => r.player_id));
  const newStinters = starterPlayerIds.filter((id) => !playersWithStint.has(id));
  if (newStinters.length > 0) {
    const { error: stintError } = await serviceRole.from("match_lineup_stints").insert(
      newStinters.map((playerId) => ({
        session_id: sessionId,
        player_id: playerId,
        started_minute: 0,
      }))
    );
    if (stintError) {
      return err({ code: "unknown", message: stintError.message });
    }
  }

  try {
    await logAccess("lineup.starters_set", "session", sessionId);
  } catch (e) {
    console.error("[setStartingLineup] audit log failed (non-blocking)", e);
  }

  return ok(undefined);
}
