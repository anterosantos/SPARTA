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

  // 4. Broadcasts futuros: quando implementado, adicionar aqui
  // const broadcastItems = await fetchBroadcasts(player.club_id);

  return ok(convocatoriaItems);
}

/**
 * dismissPlayerNotification — Jogador dispensa uma notificação do inbox.
 * A notificação deixa de aparecer até à próxima convocatória ou até ser
 * re-enviada pelo treinador (upsert reset status a 'scheduled').
 */
export async function dismissPlayerNotification(
  sessionId: string,
  kind: string
): Promise<void> {
  if (!sessionId || !kind) return;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Upsert idempotente — dismiss repetido não cria duplicado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("player_inbox_dismissals").upsert(
    { profile_id: user.id, session_id: sessionId, kind },
    { onConflict: "profile_id,session_id,kind", ignoreDuplicates: true }
  );

  revalidatePath("/hoje");
}
