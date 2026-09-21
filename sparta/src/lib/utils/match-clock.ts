/**
 * Cronómetro em directo da captura de eventos — helpers puros (sem I/O),
 * testáveis isoladamente. A fase deriva-se sempre dos marcadores persistidos
 * (eventos match_start/half_time/second_half_start), nunca de estado só do
 * cliente — assim sobrevive a um refresh da página a meio do jogo.
 */

export type MatchPhase = "not_started" | "first_half" | "break" | "second_half";

export interface MatchPhaseMarkers {
  matchStartAt: string | null;
  firstHalfEndAt: string | null;
  secondHalfStartAt: string | null;
}

/** Duração nominal do intervalo — a contagem decrescente parte daqui. */
export const HALF_TIME_BREAK_SECONDS = 15 * 60;

/**
 * Deriva a fase actual a partir dos marcadores. Prioriza o marcador mais
 * "avançado" presente — defensivo contra estados inconsistentes (ex.: um
 * second_half_start sem half_time, corrigido manualmente).
 */
export function deriveMatchPhase(markers: MatchPhaseMarkers): MatchPhase {
  if (markers.secondHalfStartAt) return "second_half";
  if (markers.firstHalfEndAt) return "break";
  if (markers.matchStartAt) return "first_half";
  return "not_started";
}

/**
 * Formata segundos como "mm:ss" (ou "-mm:ss" para negativos — usado para
 * assinalar o intervalo a decorrer além dos 15 minutos previstos).
 */
export function formatMatchClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(totalSeconds));
  const mm = String(Math.floor(abs / 60)).padStart(2, "0");
  const ss = String(abs % 60).padStart(2, "0");
  return `${sign}${mm}:${ss}`;
}
