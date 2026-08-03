interface CalendarViewParams {
  cumulativo?: string;
  vista?: string;
  mes?: string;
}

/**
 * Builds the `?cumulativo=&vista=&mes=` query string for the current
 * `/calendario` view state, so it can be round-tripped through "Nova sessão"
 * and back. Returns "" at the defaults (semana, não-cumulativo). Malformed
 * `mes` values are forwarded as-is — `/calendario`'s own parsing already
 * falls back safely to the current month for anything that doesn't match
 * `yyyy-MM`.
 */
export function buildCalendarViewQuery(params: CalendarViewParams): string {
  const qs = new URLSearchParams();
  if (params.cumulativo === "true") qs.set("cumulativo", "true");
  if (params.vista === "mes") {
    qs.set("vista", "mes");
    if (params.mes) qs.set("mes", params.mes);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
