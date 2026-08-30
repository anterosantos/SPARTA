"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { FileText, Grid3x3, TrendingUp } from "lucide-react";
import Link from "next/link";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamWeightFormation } from "@/components/domain/TeamWeightFormation";
import { TeamHeightFormation } from "@/components/domain/TeamHeightFormation";
import { TeamAggregateFiltersSheet, DEFAULT_FILTERS } from "@/components/domain/TeamAggregateFiltersSheet";
import type { TeamAggregateFilters } from "@/components/domain/TeamAggregateFiltersSheet";
import { getTeamAcwrChart } from "@/lib/actions/team-aggregate";
import { ACWR_THRESHOLDS } from "@/lib/readiness/thresholds";
import type {
  TeamAggregateData,
  TopPlayerItem,
  MatchEventsPoint,
  TeamAcwrSeries,
  TeamAcwrData,
  AcwrChartRange,
} from "@/lib/actions/team-aggregate";

const ACWR_RANGE_OPTIONS: { value: AcwrChartRange; label: string }[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Último mês" },
  { value: "season", label: "Época toda" },
];

// Banda segura ACWR de referência para a vista agregada da equipa (mistura
// jogadores de vários escalões, cada um com o seu próprio limiar em
// lib/readiness/thresholds.ts) — usa-se aqui o limiar mais conservador (u14,
// 0.8–1.3), a "zona segura" genérica citada em Gabbett (2016).
const ACWR_SAFE_BAND = ACWR_THRESHOLDS.u14;

interface TeamAggregateDashboardProps {
  data: TeamAggregateData;
}

// Estilo do tooltip do Recharts via tokens de tema (var(--*) de globals.css) — o
// contentStyle por omissão do Recharts é sempre branco/preto fixo e fica ilegível
// em modo escuro, já que não segue as CSS custom properties do tema.
const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--foreground)",
};

// Ângulo dourado (~137.5°) — gera cores bem distribuídas e distintas mesmo para
// um número de jogadores desconhecido à partida, sem precisar de uma paleta fixa.
function lineColorForIndex(index: number): string {
  const hue = (index * 137.508) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

function TopPlayerCard({
  player,
  valueLabel,
}: {
  player: TopPlayerItem;
  valueLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1">
      <p className="text-sm font-semibold text-foreground truncate">
        {player.playerName}
      </p>
      <p className="text-xs text-muted-foreground">
        {player.position} · {player.ageGroup}
      </p>
      <p className="text-lg font-bold text-primary">
        {player.value.toLocaleString("pt-PT")}
      </p>
      <p className="text-xs text-muted-foreground">{valueLabel}</p>
    </div>
  );
}

export function TeamAggregateDashboard({ data }: TeamAggregateDashboardProps) {
  const [filters, setFilters] = useState<TeamAggregateFilters>(DEFAULT_FILTERS);
  const [showPdfComingSoon, setShowPdfComingSoon] = useState(false);

  // ACWR da equipa — intervalo seleccionável (o carregamento inicial da página já
  // vem com range="30d" embutido em data.teamAcwr; só se refaz o pedido ao
  // servidor quando o utilizador troca de intervalo).
  const [acwrRange, setAcwrRange] = useState<AcwrChartRange>("30d");
  const [acwrData, setAcwrData] = useState<TeamAcwrData>(data.teamAcwr);
  const [acwrLoading, setAcwrLoading] = useState(false);
  const [acwrError, setAcwrError] = useState<string | null>(null);
  const [hiddenPlayerIds, setHiddenPlayerIds] = useState<Set<string>>(new Set());
  const isFirstAcwrRange = useRef(true);

  useEffect(() => {
    if (isFirstAcwrRange.current) {
      isFirstAcwrRange.current = false;
      return;
    }
    let cancelled = false;
    setAcwrLoading(true);
    setAcwrError(null);
    getTeamAcwrChart(acwrRange).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAcwrData(result.data);
      } else {
        setAcwrError(result.error.message);
      }
      setAcwrLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [acwrRange]);

  const toggleHiddenPlayer = useCallback((playerId: string) => {
    setHiddenPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }, []);

  const handleFilter = useCallback((newFilters: TeamAggregateFilters) => {
    setFilters(newFilters);
  }, []);

  // Filtrar top-3 por ageGroup (client-side)
  const filteredTopLoaded: TopPlayerItem[] =
    filters.ageGroup === "all"
      ? data.topLoaded
      : data.topLoaded.filter((p) => p.ageGroup === filters.ageGroup);

  const filteredTopFatigued: TopPlayerItem[] =
    filters.ageGroup === "all"
      ? data.topFatigued
      : data.topFatigued.filter((p) => p.ageGroup === filters.ageGroup);

  // Filtrar eventos por competição
  const filteredEvents: MatchEventsPoint[] =
    filters.competition === "all"
      ? data.eventsPerMatch
      : data.eventsPerMatch.filter((e) => e.sessionType === filters.competition);

  const filteredSquad =
    filters.ageGroup === "all"
      ? data.squadFormation
      : data.squadFormation.filter((p) => p.ageGroup === filters.ageGroup);

  const filteredAcwrSeries: TeamAcwrSeries[] =
    filters.ageGroup === "all"
      ? acwrData.series
      : acwrData.series.filter((s) => s.ageGroup === filters.ageGroup);

  const hasAgeGroupFilter = filters.ageGroup !== "all";

  return (
    <div className="space-y-6">
      {/* Barra de controles */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {data.currentSeason && (
            <span className="text-sm text-muted-foreground border border-border rounded-full px-3 py-1">
              {data.currentSeason.name}
            </span>
          )}
          <TeamAggregateFiltersSheet
            onFilter={handleFilter}
            initialFilters={DEFAULT_FILTERS}
          />
          <Link
            href="/equipa/presencas"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Ver matriz de presenças da equipa"
          >
            <Grid3x3 className="h-4 w-4" aria-hidden="true" />
            Matriz de Presenças
          </Link>
        </div>

        {data.userRole === "coach" && (
          <div>
            <button
              type="button"
              onClick={() => setShowPdfComingSoon(true)}
              aria-label="Exportar PDF (disponível em breve)"
              aria-disabled="true"
              disabled
              className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground opacity-60 cursor-not-allowed"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Exportar PDF
            </button>
            {showPdfComingSoon && (
              <CalmConfirmation
                message="Exportação PDF disponível em breve (Story 7.6)."
                onDismiss={() => setShowPdfComingSoon(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Aviso filtro por grupo etário (MVP) */}
      {hasAgeGroupFilter && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Filtro por grupo etário aplicado — gráficos de fadiga e presenças mostram dados
          pré-calculados para todo o plantel. Para análise por grupo, ver{" "}
          <Link href="/tendencias/fadiga" className="underline underline-offset-2">
            Tendências
          </Link>
          .
        </div>
      )}

      {/* Gráficos de linha — fadiga e presença */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Fadiga média semanal */}
        <section aria-labelledby="chart-fatigue-heading">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2
              id="chart-fatigue-heading"
              className="text-sm font-semibold text-foreground flex items-center gap-1"
            >
              <TooltipExplain
                term="Fadiga média"
                definition="Inverso do bem-estar médio das 5 dimensões (energia, foco, sono, dores, humor) de todos os jogadores nas últimas 4 semanas — quanto mais alto, mais fadigada está a equipa."
                formula="6 − avg(dim_energy + dim_focus + dim_sleep + dim_soreness + dim_mood) / 5"
              />
            </h2>
            {data.weeklyFatigue.every((pt) => pt.avgFatigue === 0) ? (
              <EmptyState
                icon={<TrendingUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
                title="Sem dados de fadiga"
                description="Nenhuma resposta de fadiga nas últimas 4 semanas."
              />
            ) : (
              <div
                aria-label="Gráfico de fadiga média semanal"
                className="h-56"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weeklyFatigue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: "var(--foreground)" }}
                      itemStyle={{ color: "var(--foreground)" }}
                      formatter={(value) =>
                        typeof value === "number"
                          ? value.toLocaleString("pt-PT")
                          : String(value)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgFatigue"
                      name="Fadiga média"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {/* Taxa de presença semanal */}
        <section aria-labelledby="chart-attendance-heading">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2
              id="chart-attendance-heading"
              className="text-sm font-semibold text-foreground flex items-center gap-1"
            >
              <TooltipExplain
                term="Taxa de presença"
                definition="Percentagem de jogadores presentes ou com atraso por semana (present + late) relativamente ao total de registos."
                formula="(present + late) / total × 100"
              />
            </h2>
            {data.weeklyAttendance.every((pt) => pt.total === 0) ? (
              <EmptyState
                icon={<TrendingUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
                title="Sem dados de presença"
                description="Nenhuma presença registada nas últimas 4 semanas."
              />
            ) : (
              <div
                aria-label="Gráfico de taxa de presença semanal"
                className="h-56"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weeklyAttendance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: "var(--foreground)" }}
                      itemStyle={{ color: "var(--foreground)" }}
                      formatter={(value) =>
                        typeof value === "number"
                          ? `${value.toLocaleString("pt-PT")}%`
                          : String(value)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="attendanceRate"
                      name="Taxa de presença"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ACWR da equipa — uma linha por jogador */}
      <section aria-labelledby="chart-acwr-heading">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="chart-acwr-heading"
              className="text-sm font-semibold text-foreground flex items-center gap-1"
            >
              <TooltipExplain
                term="ACWR da equipa"
                definition="Rácio de carga aguda (7d) sobre carga crónica (28d) de cada jogador ao longo do tempo. Valores próximos de 1 indicam carga estável; muito acima ou abaixo do habitual do jogador sinaliza risco de lesão por sobrecarga ou destreino."
                formula="acute (soma sRPE 7d) / chronic (soma sRPE 28d ÷ 4)"
              />
            </h2>
            <div className="flex gap-1.5" role="group" aria-label="Intervalo do gráfico de ACWR">
              {ACWR_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAcwrRange(opt.value)}
                  aria-pressed={acwrRange === opt.value}
                  disabled={acwrLoading}
                  className={`min-h-[36px] rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
                    acwrRange === opt.value
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Banda segura ACWR: {ACWR_SAFE_BAND.lo}–{ACWR_SAFE_BAND.hi}
          </p>

          {acwrError && (
            <p role="alert" className="text-xs text-destructive">
              {acwrError}
            </p>
          )}

          {filteredAcwrSeries.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
              title="Sem dados de ACWR"
              description={`Nenhum jogador com ACWR calculado neste intervalo${hasAgeGroupFilter ? " para este grupo etário" : ""}.`}
            />
          ) : (
            <>
              <div
                aria-label="Gráfico de ACWR da equipa, uma linha por jogador"
                className="h-72"
                aria-busy={acwrLoading}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={acwrData.points}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals />

                    {/* Banda segura ACWR — mesmo padrão visual do gráfico por jogador (CargaAcwrTab) */}
                    <ReferenceArea
                      y1={ACWR_SAFE_BAND.lo}
                      y2={ACWR_SAFE_BAND.hi}
                      fill="#94a3b8"
                      fillOpacity={0.15}
                    />
                    <ReferenceLine y={ACWR_SAFE_BAND.lo} stroke="#22c55e" strokeDasharray="4 2" strokeOpacity={0.5} />
                    <ReferenceLine y={ACWR_SAFE_BAND.hi} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} />

                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: "var(--foreground)" }}
                      itemStyle={{ color: "var(--foreground)" }}
                      formatter={(value) =>
                        typeof value === "number" ? value.toFixed(2) : "—"
                      }
                    />
                    {filteredAcwrSeries.map((series, i) =>
                      hiddenPlayerIds.has(series.playerId) ? null : (
                        <Line
                          key={series.playerId}
                          type="monotone"
                          dataKey={series.playerId}
                          name={series.playerName}
                          stroke={lineColorForIndex(i)}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      )
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda clicável — permite retirar/mostrar linhas de jogadores */}
              <div
                className="flex flex-wrap gap-2 pt-1"
                role="group"
                aria-label="Mostrar ou ocultar jogadores no gráfico de ACWR"
              >
                {filteredAcwrSeries.map((series, i) => {
                  const isHidden = hiddenPlayerIds.has(series.playerId);
                  const color = lineColorForIndex(i);
                  return (
                    <button
                      key={series.playerId}
                      type="button"
                      onClick={() => toggleHiddenPlayer(series.playerId)}
                      aria-pressed={!isHidden}
                      aria-label={`${isHidden ? "Mostrar" : "Ocultar"} ${series.playerName} no gráfico`}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity ${
                        isHidden ? "opacity-40" : ""
                      }`}
                      style={{ borderColor: color }}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      {series.playerName}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Top 3 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 3 mais carregados */}
        <section aria-labelledby="top-loaded-heading">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="top-loaded-heading"
                className="text-sm font-semibold text-foreground"
              >
                Top 3 Mais Carregados
              </h2>
              <Link
                href="/tendencias/carga"
                className="text-xs text-primary underline underline-offset-2"
                aria-label="Ver carga acumulada de todos os jogadores em Tendências"
              >
                Ver carga acumulada
              </Link>
            </div>
            {filteredTopLoaded.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem dados de carga{hasAgeGroupFilter ? " para este grupo etário" : ""}.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {filteredTopLoaded.map((player) => (
                  <TopPlayerCard
                    key={player.playerId}
                    player={player}
                    valueLabel="sRPE acumulado"
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Top 3 mais fatigados */}
        <section aria-labelledby="top-fatigued-heading">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2
              id="top-fatigued-heading"
              className="text-sm font-semibold text-foreground"
            >
              Top 3 Mais Fatigados
            </h2>
            {filteredTopFatigued.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem dados de fadiga{hasAgeGroupFilter ? " para este grupo etário" : ""}.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {filteredTopFatigued.map((player) => (
                  <TopPlayerCard
                    key={player.playerId}
                    player={player}
                    valueLabel="fadiga média (1–5)"
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Eventos por jogo */}
      <section aria-labelledby="chart-events-heading">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2
            id="chart-events-heading"
            className="text-sm font-semibold text-foreground"
          >
            Eventos por Jogo / Amigável
          </h2>
          {filteredEvents.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
              title="Sem dados de eventos"
              description="Nenhum evento de jogo ou amigável registado."
            />
          ) : (
            <div
              aria-label="Gráfico de eventos por jogo"
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredEvents}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="sessionDate"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)} // MM-DD
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={{ color: "var(--foreground)" }}
                    itemStyle={{ color: "var(--foreground)" }}
                    formatter={(value) =>
                      typeof value === "number"
                        ? value.toLocaleString("pt-PT")
                        : String(value)
                    }
                    labelFormatter={(label) => `Data: ${String(label)}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="eventCount"
                    name="Eventos"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Equipa por posição — tamanho e cor da bola representam o último peso registado */}
      <section aria-labelledby="squad-formation-weight-heading">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2
            id="squad-formation-weight-heading"
            className="text-sm font-semibold text-foreground flex items-center gap-1"
          >
            <TooltipExplain
              term="Equipa por posição — Peso"
              definition="Cada jogador é colocado no campo pela sua posição primária. O tamanho e a cor da bola representam o último peso registado (Métricas físicas). Sem leitura, assume-se a média dos pesos registados no plantel menos 1 kg."
            />
          </h2>
          <TeamWeightFormation players={filteredSquad} />
        </div>
      </section>

      {/* Equipa por posição — tamanho e cor da bola representam a última altura registada */}
      <section aria-labelledby="squad-formation-height-heading">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2
            id="squad-formation-height-heading"
            className="text-sm font-semibold text-foreground flex items-center gap-1"
          >
            <TooltipExplain
              term="Equipa por posição — Altura"
              definition="Cada jogador é colocado no campo pela sua posição primária. O tamanho e a cor da bola representam a última altura registada (Métricas físicas). Sem leitura, assume-se a média das alturas registadas no plantel menos 1 cm."
            />
          </h2>
          <TeamHeightFormation players={filteredSquad} />
        </div>
      </section>
    </div>
  );
}
