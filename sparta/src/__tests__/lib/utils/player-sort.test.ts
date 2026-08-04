import { describe, it, expect } from "vitest";
import { sortPlayers, filterPlayersByPosition } from "@/lib/utils/player-sort";
import type { PlayerWithPositions } from "@/lib/actions/players";

function makePlayer(
  overrides: Partial<PlayerWithPositions> & { id: string }
): PlayerWithPositions {
  return {
    club_id: "club-1",
    profile_id: null,
    jersey_num: 1,
    full_name: "Jogador Teste",
    birthdate: "2010-01-01",
    age_group: "u15",
    is_archived: false,
    archived_at: null,
    is_active: true,
    inactive_reason: null,
    photo_path: null,
    email: null,
    invite_sent_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    positions: [],
    teams: [],
    roster: null,
    ...overrides,
  };
}

const players: PlayerWithPositions[] = [
  makePlayer({
    id: "1",
    full_name: "Tomás Alves",
    jersey_num: 16,
    positions: [{ id: "p1", position: "MC", is_primary: true, sort_order: 0 }],
  }),
  makePlayer({
    id: "2",
    full_name: "Davi Araujo",
    jersey_num: 7,
    positions: [{ id: "p2", position: "EXD", is_primary: true, sort_order: 0 }],
  }),
  makePlayer({
    id: "3",
    full_name: "David Correia",
    jersey_num: 21,
    positions: [{ id: "p3", position: "GR", is_primary: true, sort_order: 0 }],
  }),
];

describe("sortPlayers", () => {
  it("'nome' ordena por último nome (comportamento por omissão)", () => {
    const sorted = sortPlayers(players, "nome");
    expect(sorted.map((p) => p.full_name)).toEqual([
      "Tomás Alves",
      "Davi Araujo",
      "David Correia",
    ]);
  });

  it("'numero' ordena por número de camisola ascendente", () => {
    const sorted = sortPlayers(players, "numero");
    expect(sorted.map((p) => p.jersey_num)).toEqual([7, 16, 21]);
  });

  it("'posicao' ordena pela ordem declarada em POSITIONS (GR antes de médios/avançados)", () => {
    const sorted = sortPlayers(players, "posicao");
    expect(sorted.map((p) => p.full_name)).toEqual([
      "David Correia", // GR
      "Tomás Alves", // MC
      "Davi Araujo", // EXD
    ]);
  });

  it("não muta o array original", () => {
    const original = [...players];
    sortPlayers(players, "numero");
    expect(players).toEqual(original);
  });
});

describe("filterPlayersByPosition", () => {
  it("devolve todos os jogadores quando position é null", () => {
    expect(filterPlayersByPosition(players, null)).toHaveLength(3);
  });

  it("filtra pela posição primária", () => {
    const filtered = filterPlayersByPosition(players, "GR");
    expect(filtered.map((p) => p.full_name)).toEqual(["David Correia"]);
  });

  it("devolve lista vazia quando nenhum jogador tem a posição", () => {
    expect(filterPlayersByPosition(players, "LIB")).toEqual([]);
  });
});
