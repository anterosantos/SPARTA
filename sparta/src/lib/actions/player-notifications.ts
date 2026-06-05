"use server";

import { revalidatePath } from "next/cache";
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
  /** Adversário (jogos/amigáveis) */
  opponentName: string | null;
  /** Hora de concentração definida pelo treinador (HH:MM) */
  concentrationTime: string | null;
  /** Para mensagens futuras do staff */
  message: string | null;
  createdAt: string;
  // NOTA: role (titular/suplente) intencionalmente excluído — informação dada
  // pelo treinador pessoalmente fora da aplicação (decisão de design).
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  training: "Treino",
  match: "Jogo",
  friendly: "Jogo amigável",
};

/**
 * getPlayerNotifications — Notificações relevantes para o jogador no ecrã "Hoje".
 *
 * Convocatórias: sessões futuras onde o jogador está em match_lineups, excluindo
 * as que o jogador dispensou manualmente via player_inbox_dismissals.
 * As notificações desaparecem automaticamente após a data da sessão.
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
  interface LineupRow { id: string; session_id: string; created_at: string; }

  // match_lineups não tem club_id direto — isolamento garantido pelo player.id
  // (um jogador pertence a um único clube) + RLS via session_id→sessions.club_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawLineups } = await (supabase as any)
    .from("match_lineups")
    .select("id, session_id, created_at")
    .eq("player_id", player.id);

  const lineups: LineupRow[] = rawLineups ?? [];
  const lineupSessionIds: string[] = lineups.map((l) => l.session_id);

  if (lineupSessionIds.length === 0) return ok([]);

  // 2. Dismissals — notificações que o jogador removeu manualmente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawDismissals } = await (supabase as any)
    .from("player_inbox_dismissals")
    .select("session_id")
    .eq("profile_id", user.id)
    .eq("kind", "convocado")
    .in("session_id", lineupSessionIds);

  const dismissedIds = new Set<string>(
    ((rawDismissals ?? []) as Array<{ session_id: string }>).map((d) => d.session_id)
  );

  interface SessionRow {
    id: string;
    type: string;
    scheduled_at: string;
    location: string | null;
    opponent_name: string | null;
    concentration_time: string | null;
  }

  // 3. Sessões futuras (dentro de 2 semanas, não canceladas, não dispensadas)
  // opponent_name ainda não está nos tipos gerados do Supabase — usar cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawSessions } = await (supabase as any)
    .from("sessions")
    .select("id, type, scheduled_at, location, opponent_name, concentration_time")
    .in("id", lineupSessionIds)
    .eq("club_id", player.club_id)
    .neq("status", "cancelled")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", twoWeeksLater.toISOString())
    .order("scheduled_at", { ascending: true });
  const sessions: SessionRow[] = rawSessions ?? [];

  const lineupMap = new Map(
    lineups.map((l) => [l.session_id, { id: l.id, createdAt: l.created_at }])
  );

  const convocatoriaItems: PlayerNotificationItem[] = sessions
    .filter((s) => !dismissedIds.has(s.id))
    .map((s) => {
      const lineup = lineupMap.get(s.id);
      return {
        id: lineup?.id ?? s.id,
        kind: "convocado" as PlayerNotificationKind,
        sessionId: s.id,
        sessionTypeLabel: SESSION_TYPE_LABELS[s.type] ?? s.type,
        sessionScheduledAt: s.scheduled_at,
        sessionLocation: s.location ?? null,
        opponentName: s.opponent_name ?? null,
        concentrationTime: s.concentration_time ?? null,
        message: null,
        createdAt: lineup?.createdAt ?? s.scheduled_at,
      };
    });

  // 4. Broadcasts do clube nos últimos 30 dias
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawBroadcasts } = await (supabase as any)
    .from("broadcasts")
    .select("id, message, created_at")
    .eq("club_id", player.club_id)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(20);

  const broadcastIds: string[] = ((rawBroadcasts ?? []) as Array<{ id: string }>).map(
    (b) => b.id
  );

  let dismissedBroadcastIds = new Set<string>();
  if (broadcastIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawBroadcastDismissals } = await (supabase as any)
      .from("broadcast_dismissals")
      .select("broadcast_id")
      .eq("profile_id", user.id)
      .in("broadcast_id", broadcastIds);

    dismissedBroadcastIds = new Set<string>(
      ((rawBroadcastDismissals ?? []) as Array<{ broadcast_id: string }>).map(
        (d) => d.broadcast_id
      )
    );
  }

  interface BroadcastRow { id: string; message: string; created_at: string; }
  const broadcastItems: PlayerNotificationItem[] = (
    (rawBroadcasts ?? []) as BroadcastRow[]
  )
    .filter((b) => !dismissedBroadcastIds.has(b.id))
    .map((b) => ({
      id: b.id,
      kind: "broadcast" as PlayerNotificationKind,
      sessionId: null,
      sessionTypeLabel: null,
      sessionScheduledAt: null,
      sessionLocation: null,
      opponentName: null,
      concentrationTime: null,
      message: b.message,
      createdAt: b.created_at,
    }));

  return ok([...broadcastItems, ...convocatoriaItems]);
}

/**
 * dismissPlayerNotification — Jogador dispensa uma notificação do inbox.
 *
 * Para kind="convocado": id = sessionId → player_inbox_dismissals
 * Para kind="broadcast": id = broadcastId → broadcast_dismissals
 */
export async function dismissPlayerNotification(
  id: string,
  kind: string
): Promise<void> {
  if (!id || !kind) return;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  if (kind === "broadcast") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("broadcast_dismissals").upsert(
      { profile_id: user.id, broadcast_id: id },
      { onConflict: "profile_id,broadcast_id", ignoreDuplicates: true }
    );
  } else {
    // convocado: id = sessionId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("player_inbox_dismissals").upsert(
      { profile_id: user.id, session_id: id, kind },
      { onConflict: "profile_id,session_id,kind", ignoreDuplicates: true }
    );
  }

  revalidatePath("/hoje");
}
