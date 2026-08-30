/**
 * team-acwr.test.ts — Testes unitários da bucketização/agregação do gráfico
 * "ACWR da equipa" (buildAcwrBuckets, aggregateAcwrRows).
 */

import { describe, it, expect } from "vitest";
import { buildAcwrBuckets, aggregateAcwrRows } from "../team-acwr";
import type { AcwrSnapshotRow } from "../team-acwr";

const PLAYER_1 = "player-1";
const PLAYER_2 = "player-2";

describe("buildAcwrBuckets", () => {
  const now = new Date("2026-08-30T12:00:00Z");

  it("'7d' devolve 7 buckets diários, do mais antigo para o mais recente", () => {
    const buckets = buildAcwrBuckets("7d", now, null);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]!.start.getTime()).toBeLessThan(buckets[6]!.start.getTime());
    // Cada bucket cobre exactamente 24h
    for (const b of buckets) {
      expect(b.end.getTime() - b.start.getTime()).toBe(24 * 60 * 60 * 1000);
    }
    // O último bucket termina em "now"
    expect(buckets[6]!.end.getTime()).toBe(now.getTime());
  });

  it("'30d' devolve 30 buckets diários, do mais antigo para o mais recente", () => {
    const buckets = buildAcwrBuckets("30d", now, null);
    expect(buckets).toHaveLength(30);
    expect(buckets[0]!.start.getTime()).toBeLessThan(buckets[29]!.start.getTime());
    for (const b of buckets) {
      expect(b.end.getTime() - b.start.getTime()).toBe(24 * 60 * 60 * 1000);
    }
    expect(buckets[29]!.end.getTime()).toBe(now.getTime());
  });

  it("'season' devolve buckets mensais desde o início da época até agora", () => {
    const buckets = buildAcwrBuckets("season", now, "2026-08-01");
    // Época começou em Agosto/2026, "now" é 30 de Agosto → só 1 bucket (Agosto)
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("'season' com época de vários meses gera um bucket por mês", () => {
    const buckets = buildAcwrBuckets("season", now, "2026-06-15");
    // Junho, Julho, Agosto → 3 buckets
    expect(buckets).toHaveLength(3);
    expect(buckets[0]!.start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(buckets[2]!.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("'season' sem data de início usa fallback de 6 meses (nunca fica vazio)", () => {
    const buckets = buildAcwrBuckets("season", now, null);
    expect(buckets.length).toBeGreaterThan(0);
  });
});

describe("aggregateAcwrRows", () => {
  const buckets = buildAcwrBuckets("30d", new Date("2026-08-30T12:00:00Z"), null);
  const players = [
    { id: PLAYER_1, full_name: "João Silva", age_group: "senior" },
    { id: PLAYER_2, full_name: "Ana Costa", age_group: "u19" },
  ];

  it("usa o snapshot mais recente por jogador/bucket", () => {
    const rows: AcwrSnapshotRow[] = [
      { player_id: PLAYER_1, acwr: 1.1, computed_at: buckets[3]!.start.toISOString() },
      {
        player_id: PLAYER_1,
        acwr: 1.4,
        computed_at: new Date(buckets[3]!.end.getTime() - 1000).toISOString(),
      },
    ];
    const result = aggregateAcwrRows(rows, buckets, players);
    expect(result.points[3]![PLAYER_1]).toBe(1.4);
  });

  it("ignora linhas com computed_at fora de todos os buckets", () => {
    const wayBefore = new Date(buckets[0]!.start.getTime() - 1000).toISOString();
    const rows: AcwrSnapshotRow[] = [{ player_id: PLAYER_1, acwr: 1.0, computed_at: wayBefore }];
    const result = aggregateAcwrRows(rows, buckets, players);
    expect(result.series).toHaveLength(0);
  });

  it("ignora linhas com computed_at inválido sem lançar erro", () => {
    const rows: AcwrSnapshotRow[] = [
      { player_id: PLAYER_1, acwr: 1.0, computed_at: "not-a-date" },
    ];
    expect(() => aggregateAcwrRows(rows, buckets, players)).not.toThrow();
    expect(aggregateAcwrRows(rows, buckets, players).series).toHaveLength(0);
  });

  it("exclui da série jogadores sem nenhum ponto não-nulo", () => {
    const rows: AcwrSnapshotRow[] = [
      { player_id: PLAYER_1, acwr: 1.0, computed_at: buckets[3]!.start.toISOString() },
    ];
    const result = aggregateAcwrRows(rows, buckets, players);
    expect(result.series.map((s) => s.playerId)).toEqual([PLAYER_1]);
  });

  it("série vem ordenada por nome (pt-PT)", () => {
    const rows: AcwrSnapshotRow[] = [
      { player_id: PLAYER_1, acwr: 1.0, computed_at: buckets[3]!.start.toISOString() },
      { player_id: PLAYER_2, acwr: 0.9, computed_at: buckets[3]!.start.toISOString() },
    ];
    const result = aggregateAcwrRows(rows, buckets, players);
    expect(result.series.map((s) => s.playerName)).toEqual(["Ana Costa", "João Silva"]);
  });

  it("sem linhas, todos os pontos ficam sem chaves de jogador e série vazia", () => {
    const result = aggregateAcwrRows([], buckets, players);
    expect(result.series).toHaveLength(0);
    expect(result.points).toHaveLength(buckets.length);
    for (const p of result.points) {
      expect(p[PLAYER_1]).toBeUndefined();
    }
  });
});
