import type { SessionType } from "@/lib/schemas/sessions"

export interface SessionColorConfig {
  bg: string
  bgDark: string
  label: string
}

export const SESSION_TYPE_COLORS: Record<SessionType, SessionColorConfig> = {
  training: { bg: "#2563EB", bgDark: "rgba(37,99,235,0.8)", label: "Treino" },
  match:    { bg: "#DC2626", bgDark: "rgba(220,38,38,0.8)",  label: "Jogo" },
  friendly: { bg: "#CA8A04", bgDark: "rgba(202,138,4,0.8)",  label: "Amigável" },
  lecture:  { bg: "#7C3AED", bgDark: "rgba(124,58,237,0.8)", label: "Palestra" },
}

/**
 * Appends " vs {adversário}" to a session type label for Jogo/Amigável when
 * opponent_name is set. Used everywhere a session's type label is displayed,
 * so the opponent (captured on the session form) is actually visible.
 */
export function sessionLabelWithOpponent(
  label: string,
  session: { type: SessionType; opponent_name?: string | null }
): string {
  if ((session.type === "match" || session.type === "friendly") && session.opponent_name) {
    return `${label} vs ${session.opponent_name}`
  }
  return label
}
