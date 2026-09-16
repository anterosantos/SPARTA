import type { SessionType } from "@/lib/schemas/sessions"

export interface SessionColorConfig {
  bg: string
  bgDark: string
  label: string
}

export const SESSION_TYPE_COLORS: Record<SessionType, SessionColorConfig> = {
  training: { bg: "#2563EB", bgDark: "rgba(37,99,235,0.8)",   label: "Treino" },
  match:    { bg: "#DC2626", bgDark: "rgba(220,38,38,0.8)",   label: "Jogo" },
  friendly: { bg: "#CA8A04", bgDark: "rgba(202,138,4,0.8)",   label: "Amigável" },
  lecture:  { bg: "#7C3AED", bgDark: "rgba(124,58,237,0.8)",  label: "Palestra" },
  medical:  { bg: "#0D9488", bgDark: "rgba(13,148,136,0.8)",  label: "Médico/Fisio" },
  other:    { bg: "#64748B", bgDark: "rgba(100,116,139,0.8)", label: "Outros" },
}

type OpponentSession = {
  type: SessionType
  opponent_name?: string | null
  is_home?: boolean | null
}

/** " (C)" em casa, " (F)" fora, "" quando is_home não está definido. */
function homeAwaySuffix(session: Pick<OpponentSession, "is_home">): string {
  if (session.is_home === true) return " (C)"
  if (session.is_home === false) return " (F)"
  return ""
}

/**
 * Appends " vs {adversário} (C|F)" to a session type label for Jogo/Amigável
 * when opponent_name is set. Used everywhere a session's type label is
 * displayed, so o adversário e casa/fora (capturados no formulário) ficam
 * visíveis.
 */
export function sessionLabelWithOpponent(label: string, session: OpponentSession): string {
  if ((session.type === "match" || session.type === "friendly") && session.opponent_name) {
    return `${label} vs ${session.opponent_name}${homeAwaySuffix(session)}`
  }
  return label
}

/**
 * Versão compacta para espaços apertados (chip do calendário mensal): omite a
 * palavra do tipo ("Jogo"/"Amigável") — a cor do chip já a substitui — e
 * mostra directamente "vs Adversário (C|F)".
 */
export function sessionCompactLabel(label: string, session: OpponentSession): string {
  if ((session.type === "match" || session.type === "friendly") && session.opponent_name) {
    return `vs ${session.opponent_name}${homeAwaySuffix(session)}`
  }
  return label
}
