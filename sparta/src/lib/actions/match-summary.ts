"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffRole } from "@/lib/actions/auth";
import { auditedRead } from "@/lib/data/audited";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

export interface MatchSummaryGoal {
  playerId: string | null;
  playerName: string | null;
  jerseyNum: number | null;
  minute: number | null;
  period: number;
  team: "own" | "opponent";
}

export interface MatchSummaryCard {
  playerId: string | null;
  playerName: string | null;
  jerseyNum: number | null;
  cardType: "yellow" | "red";
  period: number;
}

export interface MatchSummaryPlayer {
  playerId: string;
  fullName: string;
  jerseyNum: number | null;
  role: "starter" | "bench" | "convocado_only";
  minutesPlayed: number;
}

export interface MatchSummaryData {
  session: {
    id: string;
    opponentName: string | null;
    scheduledAt: string;
    durationMin: number;
    type: string;
    status: string;
  };
  score: { own: number; opponent: number };
  goals: MatchSummaryGoal[];
  cards: MatchSummaryCard[];
  players: MatchSummaryPlayer[];
}

/**
 * getMatchSummary — Estatísticas consolidadas de um jogo/amigável, disponível depois
 * de "Fechar jogo" (closeMatchRecord marca sessions.status='completed'). Não bloqueia
 * a leitura por status — útil também para ver o resumo parcial antes do fim.
 */
export async function getMatchSummary(
  sessionId: string
): Promise<Result<MatchSummaryData, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId, userId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: session, error: sessionError } = await serviceRole
    .from("sessions")
    .select("id, opponent_name, scheduled_at, duration_min, type, status")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();
  if (sessionError) {
    return err({ code: "unknown", message: sessionError.message });
  }
  if (!session) return err({ code: "not_found", message: "Sessão não encontrada" });

  type LineupRow = {
    player_id: string;
    role: string;
    shirt_num: number | null;
    players: { full_name: string; jersey_num: number } | null;
  };

  const [eventsRes, lineupsRes, minutesRes] = await Promise.all([
    auditedRead(
      {
        targetKind: "session_metrics",
        targetId: sessionId,
        action: "match_summary.fetch_events",
        actorId: userId,
        clubId,
      },
      async () =>
        // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
        serviceRole
          .from("match_events")
          .select("id, action, player_id, context")
          .eq("session_id", sessionId)
          .eq("club_id", clubId)
          .eq("is_deleted", false)
          .in("action", ["goal", "card"])
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceRole.from as any)("match_lineups")
      .select("player_id, role, shirt_num, players(full_name, jersey_num)")
      .eq("session_id", sessionId) as Promise<{
      data: LineupRow[] | null;
      error: { message: string } | null;
    }>,
    serviceRole
      .from("match_minutes_played")
      .select("player_id, minutes_played")
      .eq("session_id", sessionId),
  ]);

  if (eventsRes.error) {
    return err({ code: "unknown", message: eventsRes.error.message });
  }
  if (lineupsRes.error) {
    return err({ code: "unknown", message: lineupsRes.error.message });
  }
  if (minutesRes.error) {
    return err({ code: "unknown", message: minutesRes.error.message });
  }

  const nameByPlayer = new Map<string, string>();
  const jerseyByPlayer = new Map<string, number | null>();
  for (const l of lineupsRes.data ?? []) {
    nameByPlayer.set(l.player_id, l.players?.full_name ?? "—");
    jerseyByPlayer.set(l.player_id, l.shirt_num ?? l.players?.jersey_num ?? null);
  }

  const minutesByPlayer = new Map<string, number>();
  for (const m of minutesRes.data ?? []) {
    if (!m.player_id) continue;
    minutesByPlayer.set(m.player_id, m.minutes_played ?? 0);
  }

  const goals: MatchSummaryGoal[] = [];
  const cards: MatchSummaryCard[] = [];
  let ownGoals = 0;
  let opponentGoals = 0;

  for (const e of eventsRes.data ?? []) {
    const context = (e.context ?? {}) as Record<string, unknown>;
    if (e.action === "goal") {
      const team: "own" | "opponent" = context.team === "opponent" ? "opponent" : "own";
      if (team === "own") ownGoals++;
      else opponentGoals++;
      goals.push({
        playerId: e.player_id,
        playerName: e.player_id ? (nameByPlayer.get(e.player_id) ?? null) : null,
        jerseyNum: e.player_id ? (jerseyByPlayer.get(e.player_id) ?? null) : null,
        minute: typeof context.minute === "number" ? context.minute : null,
        period: typeof context.period === "number" ? context.period : 1,
        team,
      });
    } else if (e.action === "card") {
      cards.push({
        playerId: e.player_id,
        playerName: e.player_id ? (nameByPlayer.get(e.player_id) ?? null) : null,
        jerseyNum: e.player_id ? (jerseyByPlayer.get(e.player_id) ?? null) : null,
        cardType: context.card_type === "red" ? "red" : "yellow",
        period: typeof context.period === "number" ? context.period : 1,
      });
    }
  }

  goals.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  const players: MatchSummaryPlayer[] = (lineupsRes.data ?? [])
    .map((l) => ({
      playerId: l.player_id,
      fullName: l.players?.full_name ?? "—",
      jerseyNum: l.shirt_num ?? l.players?.jersey_num ?? null,
      role: l.role as MatchSummaryPlayer["role"],
      minutesPlayed: minutesByPlayer.get(l.player_id) ?? 0,
    }))
    .sort((a, b) => {
      // Titulares/quem jogou primeiro, depois por minutos jogados desc, depois nome
      if (b.minutesPlayed !== a.minutesPlayed) return b.minutesPlayed - a.minutesPlayed;
      return a.fullName.localeCompare(b.fullName, "pt-PT");
    });

  return ok({
    session: {
      id: session.id,
      opponentName: session.opponent_name,
      scheduledAt: session.scheduled_at,
      durationMin: session.duration_min,
      type: session.type,
      status: session.status,
    },
    score: { own: ownGoals, opponent: opponentGoals },
    goals,
    cards,
    players,
  });
}
