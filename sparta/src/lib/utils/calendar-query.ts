interface CalendarViewParams {
  vista?: string;
  mes?: string;
}

/**
 * Builds the `?vista=&mes=` query string for the current `/calendario` view
 * state, so it can be round-tripped through "Nova sessão" and back. Returns
 * "" at the default (mês, sem `mes` alvo). Malformed `mes` values are
 * forwarded as-is — `/calendario`'s own parsing já cai em segurança para o
 * mês actual para o que não corresponder a `yyyy-MM`.
 */
export function buildCalendarViewQuery(params: CalendarViewParams): string {
  const qs = new URLSearchParams();
  if (params.vista === "semana") {
    qs.set("vista", "semana");
  } else if (params.mes) {
    // vista "mes" é o default — omitimos o parâmetro, mas mantemos o mês alvo
    qs.set("mes", params.mes);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
