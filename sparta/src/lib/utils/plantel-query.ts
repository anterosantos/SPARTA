import type { PlayerSort } from "@/lib/utils/player-sort";

/**
 * Builds the `?ordenar=&posicao=` query string for the current sort/filter
 * state, so it can be preserved when toggling Ver activos/inativos on
 * `/plantel`. Returns "" at the default sort ("nome") with no position filter.
 */
export function buildPlantelSortFilterQuery(state: {
  sort: PlayerSort;
  position: string | null;
}): string {
  const qs = new URLSearchParams();
  if (state.sort !== "nome") qs.set("ordenar", state.sort);
  if (state.position) qs.set("posicao", state.position);
  const s = qs.toString();
  return s ? `?${s}` : "";
}
