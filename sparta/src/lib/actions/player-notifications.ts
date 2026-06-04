"use server";

import { createServerClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

export type PlayerNotificationKind = "convocado" | "broadcast";

export interface PlayerNotificationItem {
  id: string;
  kind: PlayerNotificationKind;
  sessionId: string | null;
  /** Tipo de sessão formatado (ex: "Jogo", "Treino") */
  sessionTypeLabel: string | null;
  /** scheduled_at ISO da sessão */
  sessionScheduledAt: string | null;
  /** Local da sessão */
  sessionLocation: string | null;
  /** Papel do jogador na convocatória: "starter" | "bench" */
  role: "starter" | "bench" | null;
  /** Para mensagens futuras do staff */
  message: string | null;
  createdAt: string;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  training: "Treino",
  match: "Jogo",
  friendly: "Jogo amigável",
};

/**
 * getPlayerNotifications — Notificações relevantes para o jogador no ecrã "Hoje".
 *
 * Fontes actuais:
 *   - Convocatórias: sessões nas próximas 2 semanas onde o jogador está em match_lineups
 *
 * Fontes futuras (estrutura pronta):
 *   - Mensagens de broadcast do staff
 *
 * Excluídas intencionalmente: fatigue_pre, fatigue_post, player_absence
 * (são notificações de sistema, não mensagens do staff para o jogador)
 */
export async function getPlayerNotifications(): Promise<
  Result<PlayerNotificationItem[], AppError>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  // Encontrar o registo do jogador
  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!player) return ok([]); // Sem registo de jogador → sem notificações

  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // 1. Convocatórias: sessões futuras onde o jogador está em match_lineups
  interface LineupRow { id: string; session_id: string; role: "starter" | "bench"; created_at: string; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawLineups } = await (supabase as any)
    .from("match_lineups")
    .select("id, session_id, role, created_at")
    .eq("player_id", player.id)
    .eq("club_id", player.club_id);

  const lineups: LineupRow[] = rawLineups ?? [];
  const lineupSessionIds: string[] = lineups.map((l) => l.session_id);

  let convocatoriaItems: PlayerNotificationItem[] = [];

  if (lineupSessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, type, scheduled_at, location")
      .in("id", lineupSessionIds)
      .eq("club_id", player.club_id)
      .neq("status", "cancelled")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", twoWeeksLater.toISOString())
      .order("scheduled_at", { ascending: true });

    const lineupMap = new Map(
      lineups.map((l) => [
        l.session_id,
        { id: l.id, role: l.role, createdAt: l.created_at },
      ])
    );

    convocatoriaItems = (sessions ?? []).map((s) => {
      const lineup = lineupMap.get(s.id);
      return {
        id: lineup?.id ?? s.id,
        kind: "convocado" as PlayerNotificationKind,
        sessionId: s.id,
        sessionTypeLabel: SESSION_TYPE_LABELS[s.type] ?? s.type,
        sessionScheduledAt: s.scheduled_at,
        sessionLocation: s.location ?? null,
        role: lineup?.role ?? null,
        message: null,
        createdAt: lineup?.createdAt ?? s.scheduled_at,
      };
    });
  }

  // 2. Broadcasts futuros: quando implementado, adicionar aqui
  // const broadcastItems = await fetchBroadcasts(player.club_id);

  return ok(convocatoriaItems);
}
