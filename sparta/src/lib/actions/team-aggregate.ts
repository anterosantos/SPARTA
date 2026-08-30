"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { auditedRead } from "@/lib/data/audited";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { requireStaffRole, getPlayerIdsForTeams } from "@/lib/actions/auth";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

export type WeeklyFatiguePoint = {
  weekLabel: string;
  weekStart: string;
  avgFatigue: number;
  sampleSize: number;
};

export type WeeklyAttendancePoint = {
  weekLabel: string;
  weekStart: string;
  attendanceRate: number;
  attended: number;
  total: number;
};

export type TopPlayerItem = {
  playerId: string;
  playerName: string;
  position: string;
  ageGroup: string;
  value: number;
};

export type MatchEventsPoint = {
  sessionId: string;
  sessionDate: string;
  sessionType: "jogo" | "amigavel";
  eventCount: number;
};

export type TeamAcwrPoint = {
  weekLabel: string;
  weekStart: string;
  /** ACWR (Acute:Chronic Workload Ratio) por jogador nesta semana — null se sem
   * snapshot nessa janela. Chave = player_id. */
  values: Record<string, number | null>;
};

export type TeamAcwrSeries = {
  playerId: string;
  playerName: string;
  ageGroup: string;
};

export type TeamAcwrData = {
  points: TeamAcwrPoint[];
  /** Só jogadores com pelo menos um ponto não-nulo nas últimas 4 semanas. */
  series: TeamAcwrSeries[];
};

/**
 * Peso (kg) de último recurso, usado apenas quando NENHUM jogador do plantel
 * tem leitura de peso (não há média possível). Normalmente o peso por omissão
 * é a média dos pesos registados no plantel menos 1 kg — ver squadFormation.
 */
const DEFAULT_WEIGHT_KG = 50;

/**
 * Altura (cm) de último recurso, usado apenas quando NENHUM jogador do plantel
 * tem leitura de altura (não há média possível). Normalmente a altura por
 * omissão é a média das alturas registadas no plantel menos 1 cm — mesmo
 * racional que o peso, ver squadFormation.
 */
const DEFAULT_HEIGHT_CM = 160;

export type PlayerFormationItem = {
  playerId: string;
  playerName: string;
  position: string | null;
  ageGroup: string;
  jerseyNum: number | null;
  weightKg: number;
  hasWeightReading: boolean;
  heightCm: number;
  hasHeightReading: boolean;
};

export type TeamAggregateData = {
  weeklyFatigue: WeeklyFatiguePoint[];
  weeklyAttendance: WeeklyAttendancePoint[];
  topLoaded: TopPlayerItem[];
  topFatigued: TopPlayerItem[];
  eventsPerMatch: MatchEventsPoint[];
  squadFormation: PlayerFormationItem[];
  teamAcwr: TeamAcwrData;
  currentSeason: { id: string; name: string } | null;
  totalActivePlayers: number;
  userRole: "coach" | "analyst";
};

type FatigueRow = {
  player_id: string | null;
  submitted_at: string | null;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
};

type AcwrRow = {
  player_id: string;
  acwr: number | null;
  computed_at: string;
};

export async function getTeamAggregateData(): Promise<
  Result<TeamAggregateData, AppError>
> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId, role, teamIds } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const seasonResult = await getCurrentSeason();
  const currentSeason = seasonResult.ok ? seasonResult.data : null;

  const now = new Date();
  const since28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const weekWindows = Array.from({ length: 4 }, (_, i) => {
    const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end, label: `Sem ${4 - i}` };
  }).reverse();

  // Scope to the staff's assigned teams only
  const playerIds = await getPlayerIdsForTeams(teamIds);

  const playersArr: { id: string; full_name: string; age_group: string; jersey_num: number | null }[] = [];
  if (playerIds.length > 0) {
    const { data: playersData, error: playersError } = await serviceRole
      .from("players")
      .select("id, full_name, age_group, jersey_num")
      .in("id", playerIds)
      .is("archived_at", null);
    if (playersError) {
      return err({
        code: "db_error",
        message: playersError.message ?? "Erro ao carregar jogadores",
      });
    }
    playersArr.push(...(playersData ?? []));
  }

  const positionMap = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: posData } = await serviceRole
      .from("positions")
      .select("player_id, position")
      .in("player_id", playerIds)
      .eq("is_primary", true);
    for (const pos of posData ?? []) {
      if (pos?.player_id && pos.position) {
        positionMap.set(pos.player_id, pos.position);
      }
    }
  }

  if (playerIds.length === 0) {
    return ok({
      weeklyFatigue: weekWindows.map((w) => ({
        weekLabel: w.label,
        weekStart: w.start.toISOString(),
        avgFatigue: 0,
        sampleSize: 0,
      })),
      weeklyAttendance: weekWindows.map((w) => ({
        weekLabel: w.label,
        weekStart: w.start.toISOString(),
        attendanceRate: 0,
        attended: 0,
        total: 0,
      })),
      topLoaded: [],
      topFatigued: [],
      eventsPerMatch: [],
      squadFormation: [],
      teamAcwr: {
        points: weekWindows.map((w) => ({
          weekLabel: w.label,
          weekStart: w.start.toISOString(),
          values: {},
        })),
        series: [],
      },
      currentSeason: currentSeason
        ? { id: currentSeason.id, name: currentSeason.name ?? "" }
        : null,
      totalActivePlayers: 0,
      userRole: role as "coach" | "analyst",
    });
  }

  const [fatigueResult, attendanceResult, metricsResult, eventsResult, bodyMetricsResult, acwrResult] =
    await Promise.allSettled([
      // fatigue_responses — dados de saúde, obrigatório auditedRead (FR50)
      auditedRead<FatigueRow[]>(
        {
          action: "team_aggregate.viewed",
          targetKind: "club",
          targetId: clubId,
          actorId: userId,
          clubId,
        },
        async () => {
          // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
          const { data, error } = await serviceRole
            .from("fatigue_responses")
            .select(
              "player_id, submitted_at, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood"
            )
            .eq("club_id", clubId)
            .in("player_id", playerIds)
            .gte("submitted_at", since28.toISOString())
            .order("submitted_at", { ascending: true });
          if (error) throw error;
          return (data ?? []) as FatigueRow[];
        }
      ),
      // attendances + sessions — não é dado de saúde
      // "sessions.date" não existe (a coluna real é scheduled_at) — esta query nunca
      // devolvia linhas, daí "Sem dados de presença" mesmo com presenças registadas.
      serviceRole
        .from("attendances")
        .select("player_id, status, session_id, sessions!inner(scheduled_at, type)")
        .eq("club_id", clubId)
        .in("player_id", playerIds)
        .gte("sessions.scheduled_at", since28.toISOString()),
      // session_metrics por época (Top-3 carregados) — sRPE load data, not health data
      currentSeason?.id
        ? // eslint-disable-next-line custom/no-direct-health-data-read -- session_metrics is sRPE load data, not personal health data
          serviceRole
            .from("session_metrics")
            .select("player_id, srpe_load, sessions!inner(season_id)")
            .eq("club_id", clubId)
            .in("player_id", playerIds)
            .eq("sessions.season_id", currentSeason.id)
        : Promise.resolve({ data: [] as Array<{ player_id: string; srpe_load: number }>, error: null }),
      // match_events últimos 10 jogos/amigáveis — performance event data, not health data
      // "sessions.date" não existe (coluna real: scheduled_at), e sessions.type usa os
      // valores em inglês ("match"/"friendly"), não "jogo"/"amigavel" — esta query nunca
      // encontrava nada, daí "Sem dados de eventos" mesmo com eventos capturados.
      // .order() por uma tabela associada não aceita "tabela.coluna" no nome da coluna
      // (isso só é válido em .eq()/.gte()/.in()) — tem de ir na opção referencedTable,
      // senão o Postgrest devolve erro e a query falha silenciosamente aqui.
      // eslint-disable-next-line custom/no-direct-health-data-read -- match_events is performance data, not personal health data
      serviceRole
        .from("match_events")
        .select("session_id, sessions!inner(scheduled_at, type)")
        .eq("club_id", clubId)
        .eq("is_deleted", false)
        .in("sessions.type", ["match", "friendly"])
        .order("scheduled_at", { ascending: false, referencedTable: "sessions" })
        .limit(10),
      // player_metrics — última leitura de peso/altura por jogador (vista "Equipa por posição").
      // Uma leitura pode ter só peso ou só altura (não ambos obrigatórios), por isso não
      // filtramos por coluna aqui — cada dimensão é extraída à parte mais abaixo.
      serviceRole
        .from("player_metrics")
        .select("player_id, weight_kg, height_cm, recorded_at")
        .eq("club_id", clubId)
        .in("player_id", playerIds)
        .order("recorded_at", { ascending: false }),
      // readiness_snapshots — ACWR por jogador, dado de saúde derivado (Art. 9 RGPD),
      // obrigatório auditedRead (FR50)
      auditedRead<AcwrRow[]>(
        {
          action: "team_aggregate_acwr.viewed",
          targetKind: "readiness_snapshots",
          targetId: clubId,
          actorId: userId,
          clubId,
        },
        async () => {
          // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
          const { data, error } = await serviceRole
            .from("readiness_snapshots")
            .select("player_id, acwr, computed_at")
            .eq("club_id", clubId)
            .in("player_id", playerIds)
            .gte("computed_at", since28.toISOString())
            .order("computed_at", { ascending: true });
          if (error) throw error;
          return (data ?? []) as AcwrRow[];
        }
      ),
    ]);

  // Guard: se auditedRead() foi rejeitado, não continuar
  if (fatigueResult.status === "rejected") {
    return err({ code: "db_error", message: "Erro ao carregar dados de fadiga" });
  }

  // Processar fadiga semanal
  const fatigueRows: FatigueRow[] =
    fatigueResult.status === "fulfilled" ? fatigueResult.value : [];
  const weeklyFatigue = weekWindows.map((w) => {
    const bucket = fatigueRows.filter((r) => {
      const t = new Date(r.submitted_at ?? "").getTime();
      return t >= w.start.getTime() && t < w.end.getTime();
    });
    const playerSet = new Set(bucket.map((r) => r.player_id));
    if (bucket.length === 0) {
      return {
        weekLabel: w.label,
        weekStart: w.start.toISOString(),
        avgFatigue: 0,
        sampleSize: 0,
      };
    }
    const allDims = bucket.flatMap((r) =>
      [r.dim_energy, r.dim_focus, r.dim_sleep, r.dim_soreness, r.dim_mood].filter(
        (v): v is number => v !== null && v !== undefined
      )
    );
    // Dimensões vão de 1 (pior: esgotado/muita dor/mau humor) a 5 (melhor) — ver
    // lib/i18n/pt-PT/fatigue.ts. A média bruta é bem-estar, não fadiga; inverte-se
    // (6 − média) para que um valor mais alto no gráfico signifique mais fadiga.
    const avgWellness =
      allDims.length > 0 ? allDims.reduce((s, v) => s + v, 0) / allDims.length : 0;
    const avgFatigue = allDims.length > 0 ? 6 - avgWellness : 0;
    return {
      weekLabel: w.label,
      weekStart: w.start.toISOString(),
      avgFatigue: Math.round(avgFatigue * 10) / 10,
      sampleSize: playerSet.size,
    };
  });

  // Processar taxa de presença semanal
  type AttRow = {
    player_id: string;
    status: string;
    session_id: string;
    sessions: { scheduled_at: string; type: string };
  };
  if (attendanceResult.status === "fulfilled" && attendanceResult.value.error) {
    // Erro engolido em silêncio antes — só resultava num gráfico vazio, sem pista
    // nenhuma de que a query tinha falhado.
    console.error("[getTeamAggregateData] attendances query error:", attendanceResult.value.error);
  }
  const attRows: AttRow[] =
    attendanceResult.status === "fulfilled" && !attendanceResult.value.error
      ? // Supabase TS SDK limitation: joined select types cannot be properly inferred at compile-time
        ((attendanceResult.value.data ?? []) as unknown as AttRow[])
      : [];
  const weeklyAttendance = weekWindows.map((w) => {
    const bucket = attRows.filter((r) => {
      const dateStr = r.sessions?.scheduled_at;
      if (!dateStr) return false;
      const d = new Date(dateStr).getTime();
      if (Number.isNaN(d)) return false;
      return d >= w.start.getTime() && d < w.end.getTime();
    });
    const attended = bucket.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length;
    const total = bucket.length;
    const rate = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;
    return {
      weekLabel: w.label,
      weekStart: w.start.toISOString(),
      attendanceRate: rate,
      attended,
      total,
    };
  });

  // Top-3 mais carregados (época actual)
  type MetricRow = { player_id: string; srpe_load: number };
  const metricsRows: MetricRow[] =
    metricsResult.status === "fulfilled" &&
    !("error" in metricsResult.value && metricsResult.value.error)
      ? ((("data" in metricsResult.value
          ? metricsResult.value.data
          : metricsResult.value) ?? []) as MetricRow[])
      : [];
  const loadByPlayer = new Map<string, number>();
  for (const m of metricsRows) {
    if (m?.player_id && typeof m.srpe_load === "number") {
      loadByPlayer.set(
        m.player_id,
        (loadByPlayer.get(m.player_id) ?? 0) + m.srpe_load
      );
    }
  }
  const topLoaded = Array.from(loadByPlayer.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid, load]) => {
      const player = playersArr.find((p) => p.id === pid);
      return {
        playerId: pid,
        playerName: player?.full_name?.trim() || "—",
        position: positionMap.get(pid) ?? "—",
        ageGroup: player?.age_group ?? "—",
        value: load,
      };
    });

  // Top-3 mais fatigados (últimas 4 sem — avg das 5 dims)
  const avgFatigueByPlayer = new Map<string, { sum: number; count: number }>();
  for (const r of fatigueRows) {
    if (!r.player_id) continue;
    const dims = [
      r.dim_energy,
      r.dim_focus,
      r.dim_sleep,
      r.dim_soreness,
      r.dim_mood,
    ].filter((v): v is number => v !== null && v !== undefined);
    if (dims.length === 0) continue;
    // Média de bem-estar desta resposta (1 pior – 5 melhor); invertida abaixo.
    const avgWellness = dims.reduce((s, v) => s + v, 0) / dims.length;
    const existing = avgFatigueByPlayer.get(r.player_id) ?? {
      sum: 0,
      count: 0,
    };
    avgFatigueByPlayer.set(r.player_id, {
      sum: existing.sum + avgWellness,
      count: existing.count + 1,
    });
  }
  // Inverte bem-estar → fadiga (6 − média) para que o valor mais alto = mais fadigado,
  // consistente com weeklyFatigue acima. Sem esta inversão, "Top 3 Mais Fatigados"
  // mostrava, na verdade, os jogadores com MELHOR bem-estar.
  const topFatigued = Array.from(avgFatigueByPlayer.entries())
    .map(([pid, { sum, count }]) => ({
      playerId: pid,
      playerName:
        playersArr.find((p) => p.id === pid)?.full_name?.trim() || "—",
      position: positionMap.get(pid) ?? "—",
      ageGroup: playersArr.find((p) => p.id === pid)?.age_group ?? "—",
      value: Math.round((6 - sum / count) * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  // Eventos por jogo (últimos 10)
  type EventRow = {
    session_id: string;
    sessions: { scheduled_at: string; type: string };
  };
  if (eventsResult.status === "fulfilled" && eventsResult.value.error) {
    // Erro engolido em silêncio antes — só resultava em "Sem dados de eventos", sem
    // pista nenhuma de que a query tinha falhado (foi assim que o bug de sintaxe do
    // .order() por tabela associada passou despercebido).
    console.error("[getTeamAggregateData] match_events query error:", eventsResult.value.error);
  }
  const eventRows: EventRow[] =
    eventsResult.status === "fulfilled" && !eventsResult.value.error
      ? // Supabase TS SDK limitation: joined select types cannot be properly inferred at compile-time
        ((eventsResult.value.data ?? []) as unknown as EventRow[])
      : [];
  const eventsBySession = new Map<
    string,
    { date: string; type: string; count: number }
  >();
  for (const e of eventRows) {
    if (!e.session_id || !e.sessions?.scheduled_at) continue;
    const existing = eventsBySession.get(e.session_id);
    if (existing) {
      existing.count++;
    } else {
      eventsBySession.set(e.session_id, {
        // "YYYY-MM-DD" em Europe/Lisbon (AGENTS.md #10) — o gráfico usa
        // sessionDate.slice(5) para mostrar "MM-DD" no eixo X.
        date: new Date(e.sessions.scheduled_at).toLocaleDateString("en-CA", {
          timeZone: "Europe/Lisbon",
        }),
        type: e.sessions.type,
        count: 1,
      });
    }
  }
  // sessions.type usa valores em inglês ("match"/"friendly") — o filtro da UI
  // (TeamAggregateFiltersSheet) usa "jogo"/"amigavel" como vocabulário próprio;
  // esta é a única conversão entre os dois, feita aqui para não espalhar por todo
  // o lado o mapeamento inglês↔português.
  const eventsPerMatch = Array.from(eventsBySession.entries())
    .map(([sid, { date, type, count }]) => ({
      sessionId: sid,
      sessionDate: date,
      sessionType: (type === "friendly" ? "amigavel" : "jogo") as "jogo" | "amigavel",
      eventCount: count,
    }))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    .slice(-10);

  // Última leitura de peso/altura por jogador — linhas já vêm ordenadas por
  // recorded_at DESC, por isso a primeira ocorrência de cada player_id (por
  // dimensão) é a mais recente. Uma leitura pode só ter uma das duas colunas.
  type BodyMetricRow = { player_id: string; weight_kg: number | null; height_cm: number | null; recorded_at: string };
  const bodyMetricRows: BodyMetricRow[] =
    bodyMetricsResult.status === "fulfilled" && !bodyMetricsResult.value.error
      ? ((bodyMetricsResult.value.data ?? []) as unknown as BodyMetricRow[])
      : [];
  const lastWeightByPlayer = new Map<string, number>();
  const lastHeightByPlayer = new Map<string, number>();
  for (const row of bodyMetricRows) {
    if (!row.player_id) continue;
    if (typeof row.weight_kg === "number" && !lastWeightByPlayer.has(row.player_id)) {
      lastWeightByPlayer.set(row.player_id, row.weight_kg);
    }
    if (typeof row.height_cm === "number" && !lastHeightByPlayer.has(row.player_id)) {
      lastHeightByPlayer.set(row.player_id, row.height_cm);
    }
  }

  // Peso/altura por omissão para jogadores sem leitura: média dos valores
  // registados no plantel menos 1 (kg ou cm). Sem nenhuma leitura no plantel
  // inteiro, usa-se o valor de último recurso (não há média para calcular).
  function averageMinusOne(values: number[], fallback: number): number {
    if (values.length === 0) return fallback;
    return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length - 1) * 10) / 10;
  }
  const defaultWeightKg = averageMinusOne(Array.from(lastWeightByPlayer.values()), DEFAULT_WEIGHT_KG);
  const defaultHeightCm = averageMinusOne(Array.from(lastHeightByPlayer.values()), DEFAULT_HEIGHT_CM);

  const squadFormation: PlayerFormationItem[] = playersArr.map((p) => {
    const weightKg = lastWeightByPlayer.get(p.id);
    const heightCm = lastHeightByPlayer.get(p.id);
    return {
      playerId: p.id,
      playerName: p.full_name?.trim() || "—",
      position: positionMap.get(p.id) ?? null,
      ageGroup: p.age_group ?? "—",
      jerseyNum: p.jersey_num ?? null,
      weightKg: weightKg ?? defaultWeightKg,
      hasWeightReading: weightKg !== undefined,
      heightCm: heightCm ?? defaultHeightCm,
      hasHeightReading: heightCm !== undefined,
    };
  });

  // ACWR semanal por jogador — uma linha por jogador no gráfico "ACWR da equipa".
  // Para cada semana, usa-se o snapshot mais recente dentro da janela (o ACWR já
  // é em si um rácio de janela deslizante, por isso o último valor da semana
  // representa melhor "o estado no fim dessa semana" do que uma média).
  const acwrRows: AcwrRow[] = acwrResult.status === "fulfilled" ? acwrResult.value : [];
  const latestAcwrByPlayerWeek = new Map<string, Map<number, { value: number | null; at: number }>>();
  for (const row of acwrRows) {
    if (!row.player_id) continue;
    const t = new Date(row.computed_at).getTime();
    if (Number.isNaN(t)) continue;
    const weekIdx = weekWindows.findIndex((w) => t >= w.start.getTime() && t < w.end.getTime());
    if (weekIdx === -1) continue;
    let byWeek = latestAcwrByPlayerWeek.get(row.player_id);
    if (!byWeek) {
      byWeek = new Map();
      latestAcwrByPlayerWeek.set(row.player_id, byWeek);
    }
    const existing = byWeek.get(weekIdx);
    if (!existing || t > existing.at) {
      byWeek.set(weekIdx, { value: row.acwr, at: t });
    }
  }
  const teamAcwrPoints: TeamAcwrPoint[] = weekWindows.map((w, weekIdx) => {
    const values: Record<string, number | null> = {};
    for (const [playerId, byWeek] of latestAcwrByPlayerWeek.entries()) {
      values[playerId] = byWeek.get(weekIdx)?.value ?? null;
    }
    return { weekLabel: w.label, weekStart: w.start.toISOString(), values };
  });
  const teamAcwrSeries: TeamAcwrSeries[] = Array.from(latestAcwrByPlayerWeek.keys())
    .filter((pid) => teamAcwrPoints.some((p) => p.values[pid] != null))
    .map((pid) => ({
      playerId: pid,
      playerName: playersArr.find((p) => p.id === pid)?.full_name?.trim() || "—",
      ageGroup: playersArr.find((p) => p.id === pid)?.age_group ?? "—",
    }))
    .sort((a, b) => a.playerName.localeCompare(b.playerName, "pt-PT"));

  return ok({
    weeklyFatigue,
    weeklyAttendance,
    topLoaded,
    topFatigued,
    eventsPerMatch,
    squadFormation,
    teamAcwr: { points: teamAcwrPoints, series: teamAcwrSeries },
    currentSeason: currentSeason
      ? { id: currentSeason.id, name: currentSeason.name ?? "" }
      : null,
    totalActivePlayers: playersArr.length,
    userRole: role as "coach" | "analyst",
  });
}
