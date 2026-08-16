/**
 * late-risk.ts — Cálculo puro do risco de atraso na Prontidão a partir do horário
 * de saída da escola do jogador (Spec: spec-horario-saida-risco-atraso.md).
 *
 * Regras (I/O & Edge-Case Matrix, secção frozen do spec):
 * - Sem row de horário (weekly === null)                → 'missing'
 * - Data da sessão fora de qualquer intervalo letivo     → null (sem badge)
 * - Dia da semana sem hora de saída definida (ou fim-de-semana) → null (sem dado para avaliar)
 * - chegada (saída + 60min) >  início da sessão          → 'alert'
 * - chegada (saída + 60min) == início da sessão          → 'caution'
 * - chegada (saída + 60min) <  início da sessão          → null
 *
 * TRAVEL_MINUTES é fixo (60min) — sem geolocalização/distância (Boundaries & Constraints).
 * Comparações de data/dia-da-semana/hora sempre em Europe/Lisbon (nunca UTC cru).
 *
 * Função pura — sem I/O, sem dependências externas. Testada em late-risk.test.ts.
 */

import type { WeeklySchedule, SchoolTerm } from "@/lib/schemas/school-schedule";

/** Deslocação assumida fixa em minutos — sem margem de tolerância configurável. */
export const TRAVEL_MINUTES = 60;

const TZ = "Europe/Lisbon";

export type LateRiskState = "missing" | "alert" | "caution" | null;

/** Nomes dos campos de player_school_schedule por dia da semana (1=Seg ... 5=Sex). Fim-de-semana (0, 6) não tem campo. */
const WEEKDAY_FIELD: Record<number, keyof WeeklySchedule> = {
  1: "mon_time",
  2: "tue_time",
  3: "wed_time",
  4: "thu_time",
  5: "fri_time",
};

interface LisbonParts {
  /** Data local em Lisboa, formato YYYY-MM-DD — usada para verificar intervalo letivo. */
  dateStr: string;
  /** Dia da semana local em Lisboa: 0=Domingo ... 6=Sábado. */
  weekday: number;
  /** Minutos desde a meia-noite local em Lisboa (0–1439). */
  minutesOfDay: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** Extrai data/dia-da-semana/hora locais de Lisboa a partir de um ISO datetime (sempre em Europe/Lisbon — nunca UTC cru). */
function getLisbonParts(iso: string): LisbonParts {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = get("hour");
  const minute = get("minute");
  // Alguns runtimes devolvem "24" para meia-noite mesmo com hour12:false — normalizar.
  if (hour === "24") hour = "00";
  // Validar que hora está no intervalo válido após normalização.
  const hourNum = Number(hour);
  const minuteNum = Number(minute);
  if (isNaN(hourNum) || isNaN(minuteNum) || hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) {
    throw new Error(`Invalid Intl time conversion: hour=${hour}, minute=${minute}`);
  }
  const weekdayShort = get("weekday").toLowerCase().slice(0, 3);
  const weekdayNum = WEEKDAY_INDEX[weekdayShort];
  if (weekdayNum === undefined) {
    throw new Error(`Invalid Intl weekday conversion: ${weekdayShort}`);
  }

  return {
    dateStr: `${year}-${month}-${day}`,
    weekday: weekdayNum,
    minutesOfDay: hourNum * 60 + minuteNum,
  };
}

/** Converte "HH:mm" em minutos desde a meia-noite. Rejeita valores fora do intervalo (0-23 horas, 0-59 minutos). */
function timeStringToMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Invalid time format: ${hhmm}`);
  }
  return h * 60 + m;
}

/** Verifica se `dateStr` (YYYY-MM-DD) cai dentro de algum intervalo letivo (inclusivo). */
function isWithinAnyTerm(dateStr: string, terms: SchoolTerm[]): boolean {
  return terms.some((t) => dateStr >= t.startDate && dateStr <= t.endDate);
}

/** Resultado detalhado do cálculo — inclui a hora de saída usada, para exibição na UI. */
export interface LateRiskDetails {
  state: LateRiskState;
  /** Hora de saída (HH:mm) do dia da semana da sessão, quando existiu dado para calcular o estado. */
  exitTime: string | null;
}

function computeLateRiskDetails(
  weekly: WeeklySchedule | null,
  terms: SchoolTerm[],
  sessionScheduledAtISO: string
): LateRiskDetails {
  if (weekly === null) {
    return { state: "missing", exitTime: null };
  }

  // Validar que sessionScheduledAtISO é não-null e é uma string válida.
  if (!sessionScheduledAtISO || typeof sessionScheduledAtISO !== "string") {
    return { state: null, exitTime: null };
  }

  let session: LisbonParts;
  try {
    session = getLisbonParts(sessionScheduledAtISO);
  } catch {
    return { state: null, exitTime: null };
  }

  if (!isWithinAnyTerm(session.dateStr, terms)) {
    return { state: null, exitTime: null };
  }

  const field = WEEKDAY_FIELD[session.weekday];
  const exitTime = field ? weekly[field] : null;
  if (!exitTime) {
    return { state: null, exitTime: null };
  }

  let arrivalMinutes: number;
  try {
    arrivalMinutes = timeStringToMinutes(exitTime) + TRAVEL_MINUTES;
  } catch {
    return { state: null, exitTime: null };
  }

  if (arrivalMinutes > session.minutesOfDay) return { state: "alert", exitTime };
  if (arrivalMinutes === session.minutesOfDay) return { state: "caution", exitTime };
  return { state: null, exitTime: null };
}

/**
 * computeLateRiskState — Calcula o estado de risco de atraso para uma sessão.
 *
 * @param weekly              Horário semanal do jogador, ou `null` se nunca preenchido.
 * @param terms               Intervalos letivos em que o horário é válido.
 * @param sessionScheduledAtISO ISO datetime (timestamptz) do início da sessão.
 * @returns 'missing' | 'alert' | 'caution' | null
 */
export function computeLateRiskState(
  weekly: WeeklySchedule | null,
  terms: SchoolTerm[],
  sessionScheduledAtISO: string
): LateRiskState {
  return computeLateRiskDetails(weekly, terms, sessionScheduledAtISO).state;
}

/**
 * getLateRiskDetails — Como computeLateRiskState, mas também devolve a hora de saída
 * usada no cálculo (para mostrar "Horário de saída: HH:mm" junto ao badge na UI).
 */
export function getLateRiskDetails(
  weekly: WeeklySchedule | null,
  terms: SchoolTerm[],
  sessionScheduledAtISO: string
): LateRiskDetails {
  return computeLateRiskDetails(weekly, terms, sessionScheduledAtISO);
}
