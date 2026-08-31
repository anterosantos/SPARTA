import { POSITIONS } from "@/lib/schemas/players";
import type { PlayerWithPositions } from "@/lib/actions/players";

export const PLAYER_SORT_OPTIONS = ["nome", "numero", "posicao"] as const;
export type PlayerSort = (typeof PLAYER_SORT_OPTIONS)[number];

const POSITION_ORDER: Record<string, number> = POSITIONS.reduce<Record<string, number>>(
  (acc, pos, i) => {
    acc[pos] = i;
    return acc;
  },
  {}
);

function primaryPositionOf(player: PlayerWithPositions): string | null {
  return player.positions.find((p) => p.is_primary)?.position ?? null;
}

/** Sorts a copy of `players` by the given criterion. "nome" sorts by first name (full_name starts with it). */
export function sortPlayers(
  players: PlayerWithPositions[],
  sort: PlayerSort
): PlayerWithPositions[] {
  const sorted = [...players];
  if (sort === "numero") {
    // Sem camisola (jersey_num null) fica no fim, tal como "posicao" faz para
    // posições não reconhecidas.
    sorted.sort((a, b) => (a.jersey_num ?? Infinity) - (b.jersey_num ?? Infinity));
  } else if (sort === "posicao") {
    sorted.sort((a, b) => {
      const posA = primaryPositionOf(a);
      const posB = primaryPositionOf(b);
      const orderA = posA !== null ? (POSITION_ORDER[posA] ?? POSITIONS.length) : POSITIONS.length;
      const orderB = posB !== null ? (POSITION_ORDER[posB] ?? POSITIONS.length) : POSITIONS.length;
      if (orderA !== orderB) return orderA - orderB;
      return a.full_name.localeCompare(b.full_name, "pt");
    });
  } else {
    sorted.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt"));
  }
  return sorted;
}

/** Filters to players whose primary position matches `position` (no-op when `position` is null/unrecognized). */
export function filterPlayersByPosition(
  players: PlayerWithPositions[],
  position: string | null
): PlayerWithPositions[] {
  if (!position) return players;
  return players.filter((p) => primaryPositionOf(p) === position);
}
