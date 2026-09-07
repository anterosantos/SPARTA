/**
 * Computes the end instant of a session from its start + duration.
 * Display-only — duration is not persisted as an end time in the DB.
 */
export function sessionEndDate(scheduledAt: string, durationMin: number): Date {
  return new Date(new Date(scheduledAt).getTime() + durationMin * 60000);
}

// ─── Timezone-aware weekly repetition ────────────────────────────────────────
//
// Somar 7×24h em milissegundos NÃO preserva a hora de parede quando o intervalo
// atravessa a mudança de hora (último domingo de outubro / março em Portugal):
// uma sessão às 19:45 passava a aparecer às 18:45 a partir da semana da mudança.
// Estes helpers avançam semanas em "tempo local" e resolvem o offset correcto no
// instante de destino — a hora de parede e o dia da semana mantêm-se fixos.

const DEFAULT_TZ = "Europe/Lisbon";

/** Offset (ms) a somar a um instante UTC para obter a leitura de parede em `timeZone`. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUTC - date.getTime();
}

/** Componentes de parede de `date` tal como lidos em `timeZone`. */
export function zonedParts(date: Date, timeZone: string = DEFAULT_TZ) {
  const local = new Date(date.getTime() + timeZoneOffsetMs(date, timeZone));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

/**
 * Instante UTC cuja leitura de parede em `timeZone` é o Y/M/D H:M dado.
 * Uma única refinação do offset resolve todos os casos reais de mudança de hora
 * (o offset muda no máximo 1h e nunca duas vezes no mesmo dia).
 */
export function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = DEFAULT_TZ
): Date {
  const naiveUTC = Date.UTC(year, month - 1, day, hour, minute);
  const offset = timeZoneOffsetMs(new Date(naiveUTC), timeZone);
  let result = new Date(naiveUTC - offset);
  const refined = timeZoneOffsetMs(result, timeZone);
  if (refined !== offset) result = new Date(naiveUTC - refined);
  return result;
}

/**
 * Soma `weeks` semanas de calendário a `iso`, mantendo a hora de parede e o dia
 * da semana fixos em `timeZone`. Correcto ao atravessar mudanças de hora — ao
 * contrário de somar 7×24h em milissegundos.
 */
export function addWeeksInTimeZone(
  iso: string,
  weeks: number,
  timeZone: string = DEFAULT_TZ
): Date {
  const p = zonedParts(new Date(iso), timeZone);
  // Avança a contagem de dias em espaço "local" para o mês/ano rolarem bem.
  const advanced = new Date(Date.UTC(p.year, p.month - 1, p.day + weeks * 7));
  return zonedWallClockToUtc(
    advanced.getUTCFullYear(),
    advanced.getUTCMonth() + 1,
    advanced.getUTCDate(),
    p.hour,
    p.minute,
    timeZone
  );
}
