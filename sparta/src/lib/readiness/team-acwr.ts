/**
 * team-acwr.ts — Bucketização e agregação do gráfico "ACWR da equipa"
 *
 * Funções puras, sem DB — mesma separação estabelecida em lib/readiness/acwr.ts
 * (computeAcwrFromRawData): mantém a lógica de negócio testável isoladamente e
 * reutilizável entre getTeamAggregateData() (intervalo "30d" por omissão, no
 * carregamento inicial da página) e getTeamAcwrChart() (troca de intervalo
 * pedida pelo cliente).
 */

export type AcwrChartRange = "7d" | "30d" | "season";

export type TeamAcwrPoint = {
  weekLabel: string;
  weekStart: string;
  /** ACWR por jogador neste ponto — null se sem snapshot nessa janela. Uma
   * chave adicional por player_id (valor plano, não aninhado, para
   * compatibilidade directa com dataKey do Recharts). */
  [playerId: string]: string | number | null;
};

export type TeamAcwrSeries = {
  playerId: string;
  playerName: string;
  ageGroup: string;
};

export type TeamAcwrData = {
  points: TeamAcwrPoint[];
  /** Só jogadores com pelo menos um ponto não-nulo no intervalo seleccionado. */
  series: TeamAcwrSeries[];
};

export type AcwrSnapshotRow = {
  player_id: string;
  acwr: number | null;
  computed_at: string;
};

type TimeBucket = { start: Date; end: Date; label: string };

/**
 * buildAcwrBuckets — janelas de tempo do gráfico "ACWR da equipa" por intervalo.
 *
 * Granularidade escolhida para manter o gráfico legível:
 * - "7d": 7 buckets diários
 * - "30d": 30 buckets diários
 * - "season": 1 bucket por mês do calendário, do início da época actual até hoje
 *   (buckets diários/semanais numa época inteira produziriam demasiadas linhas
 *   no eixo X)
 */
function buildDailyBuckets(now: Date, days: number): TimeBucket[] {
  return Array.from({ length: days }, (_, i) => {
    const end = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const label = end.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Europe/Lisbon",
    });
    return { start, end, label };
  }).reverse();
}

export function buildAcwrBuckets(
  range: AcwrChartRange,
  now: Date,
  seasonStartDate: string | null
): TimeBucket[] {
  if (range === "7d") {
    return buildDailyBuckets(now, 7);
  }

  if (range === "30d") {
    return buildDailyBuckets(now, 30);
  }

  // "season" — buckets mensais alinhados ao calendário, do 1.º dia do mês de
  // início da época até hoje. Sem época actual definida, recua 6 meses como
  // fallback razoável (evita um gráfico vazio por falta de configuração).
  const fallbackStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const seasonStart = seasonStartDate ? new Date(`${seasonStartDate}T00:00:00Z`) : fallbackStart;
  const buckets: TimeBucket[] = [];
  let cursor = new Date(Date.UTC(seasonStart.getUTCFullYear(), seasonStart.getUTCMonth(), 1));
  while (cursor.getTime() < now.getTime()) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    buckets.push({
      start: cursor,
      end: next,
      label: cursor.toLocaleDateString("pt-PT", { month: "short", timeZone: "Europe/Lisbon" }),
    });
    cursor = next;
  }
  return buckets.length > 0 ? buckets : [{ start: seasonStart, end: now, label: "Época" }];
}

/**
 * aggregateAcwrRows — agrega snapshots de ACWR crus em pontos por bucket + série
 * por jogador.
 *
 * Para cada jogador/bucket usa-se o snapshot mais recente dentro da janela — o
 * ACWR já é em si um rácio de janela deslizante, por isso o último valor do
 * bucket representa melhor "o estado no fim desse período" do que uma média.
 */
export function aggregateAcwrRows(
  rows: AcwrSnapshotRow[],
  buckets: TimeBucket[],
  playersArr: { id: string; full_name: string; age_group: string }[]
): TeamAcwrData {
  const latestByPlayerBucket = new Map<string, Map<number, { value: number | null; at: number }>>();
  for (const row of rows) {
    if (!row.player_id) continue;
    const t = new Date(row.computed_at).getTime();
    if (Number.isNaN(t)) continue;
    const bucketIdx = buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
    if (bucketIdx === -1) continue;
    let byBucket = latestByPlayerBucket.get(row.player_id);
    if (!byBucket) {
      byBucket = new Map();
      latestByPlayerBucket.set(row.player_id, byBucket);
    }
    const existing = byBucket.get(bucketIdx);
    if (!existing || t > existing.at) {
      byBucket.set(bucketIdx, { value: row.acwr, at: t });
    }
  }

  const points: TeamAcwrPoint[] = buckets.map((b, bucketIdx) => {
    const point: TeamAcwrPoint = { weekLabel: b.label, weekStart: b.start.toISOString() };
    for (const [playerId, byBucket] of latestByPlayerBucket.entries()) {
      point[playerId] = byBucket.get(bucketIdx)?.value ?? null;
    }
    return point;
  });

  const series: TeamAcwrSeries[] = Array.from(latestByPlayerBucket.keys())
    .filter((pid) => points.some((p) => p[pid] != null))
    .map((pid) => ({
      playerId: pid,
      playerName: playersArr.find((p) => p.id === pid)?.full_name?.trim() || "—",
      ageGroup: playersArr.find((p) => p.id === pid)?.age_group ?? "—",
    }))
    .sort((a, b) => a.playerName.localeCompare(b.playerName, "pt-PT"));

  return { points, series };
}
