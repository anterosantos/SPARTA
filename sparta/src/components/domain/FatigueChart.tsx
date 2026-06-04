"use client";

import { useMemo, useEffect, useState } from "react";
import {
  LineChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { TrendingDown } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { FatigueResponse, SessionInfo } from "@/lib/actions/fatigue-staff";

const DIMENSIONS = [
  { key: "dim_energy",   label: "Energia",          color: "#3B82F6" },
  { key: "dim_focus",    label: "Concentração",      color: "#A855F7" },
  { key: "dim_sleep",    label: "Sono",              color: "#22C55E" },
  { key: "dim_soreness", label: "Dores",             color: "#EF4444" },
  { key: "dim_mood",     label: "Estado emocional",  color: "#EAB308" },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];

export interface FatigueChartProps {
  playerId: string;
  playerName: string;
  responses: FatigueResponse[];
  sessions: Record<string, SessionInfo>;
  activeDimensions?: DimensionKey[];
  activePhase?: "pre" | "post" | undefined;
}

interface ChartDataPoint {
  date: string;        // "Pré d/MM" or "Pós d/MM"
  dateRaw: string;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
  srpe_value: number | null;
  phase: string;
}

// One entry per session for the stacked bar chart
interface SessionBarPoint {
  sessionLabel: string;
  pre_dim_energy: number | null;
  pre_dim_focus: number | null;
  pre_dim_sleep: number | null;
  pre_dim_soreness: number | null;
  pre_dim_mood: number | null;
  post_dim_energy: number | null;
  post_dim_focus: number | null;
  post_dim_sleep: number | null;
  post_dim_soreness: number | null;
  post_dim_mood: number | null;
}

function formatDate(iso: string): string {
  try {
    const parsed = parseISO(iso);
    if (isNaN(parsed.getTime())) return "—";
    return format(parsed, "d/MM", { locale: pt });
  } catch {
    return "—";
  }
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-lg" role="tooltip">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) =>
        p.value !== null ? (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ) : null
      )}
    </div>
  );
}

export function FatigueChartSkeleton() {
  return (
    <div role="img" className="animate-pulse rounded-lg bg-muted" style={{ height: 260 }}
      aria-label="A carregar gráfico de fadiga..." aria-busy="true" />
  );
}

export function FatigueChart({
  playerName,
  responses,
  sessions,
  activeDimensions,
  activePhase,
}: FatigueChartProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const validActiveDims = activeDimensions?.filter((d) =>
    DIMENSIONS.some((dim) => dim.key === d)
  ) ?? DIMENSIONS.map((d) => d.key);

  const filtered = useMemo(() => {
    if (!activePhase) return responses;
    return responses.filter((r) => r.phase === activePhase);
  }, [responses, activePhase]);

  // Line chart data — label includes phase prefix for clear differentiation
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return [...filtered]
      .sort((a, b) => {
        const at = new Date(a.submitted_at).getTime();
        const bt = new Date(b.submitted_at).getTime();
        return (isNaN(at) ? 0 : at) - (isNaN(bt) ? 0 : bt);
      })
      .map((r) => ({
        date: `${r.phase === "pre" ? "Pré" : "Pós"} ${formatDate(r.submitted_at)}`,
        dateRaw: r.submitted_at,
        dim_energy:   r.dim_energy,
        dim_focus:    r.dim_focus,
        dim_sleep:    r.dim_sleep,
        dim_soreness: r.dim_soreness,
        dim_mood:     r.dim_mood,
        srpe_value:   r.srpe_value,
        phase: r.phase,
      }));
  }, [filtered]);

  const srpePoints = useMemo(
    () => chartData.filter((d) => d.srpe_value !== null),
    [chartData]
  );

  // Bar chart data — one entry per session, pre/post values side-by-side
  const barData = useMemo<SessionBarPoint[]>(() => {
    type SessionEntry = {
      sessionId: string;
      sortKey: number;
      sessionLabel: string;
      pre?: FatigueResponse;
      post?: FatigueResponse;
    };
    const map = new Map<string, SessionEntry>();

    for (const r of responses) {
      const existing = map.get(r.session_id) ?? {
        sessionId: r.session_id,
        sortKey: 0,
        sessionLabel: "",
        pre: undefined,
        post: undefined,
      };
      if (r.phase === "pre") existing.pre = r;
      else existing.post = r;
      const sessionInfo = sessions[r.session_id];
      const dateStr = sessionInfo?.scheduled_at ?? r.submitted_at;
      existing.sessionLabel = formatDate(dateStr);
      existing.sortKey = new Date(dateStr).getTime() || 0;
      map.set(r.session_id, existing);
    }

    return [...map.values()]
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((e) => ({
        sessionLabel: e.sessionLabel,
        pre_dim_energy:   e.pre?.dim_energy   ?? null,
        pre_dim_focus:    e.pre?.dim_focus    ?? null,
        pre_dim_sleep:    e.pre?.dim_sleep    ?? null,
        pre_dim_soreness: e.pre?.dim_soreness ?? null,
        pre_dim_mood:     e.pre?.dim_mood     ?? null,
        post_dim_energy:   e.post?.dim_energy   ?? null,
        post_dim_focus:    e.post?.dim_focus    ?? null,
        post_dim_sleep:    e.post?.dim_sleep    ?? null,
        post_dim_soreness: e.post?.dim_soreness ?? null,
        post_dim_mood:     e.post?.dim_mood     ?? null,
      }));
  }, [responses, sessions]);

  const visibleDimensions = DIMENSIONS.filter(
    (d) => !validActiveDims || validActiveDims.includes(d.key)
  );

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={<TrendingDown className="h-8 w-8 text-muted-foreground" />}
        title="Sem respostas ainda"
        description={`O ${playerName} vai começar a registar quando responder ao primeiro questionário.`}
      />
    );
  }

  return (
    <div className="w-full space-y-8">

      {/* ── 1. sRPE ── */}
      {srpePoints.length > 0 && (
        <div role="img" aria-label={`Gráfico sRPE — ${playerName}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 bg-slate-500" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">sRPE pós-sessão</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} />
              <YAxis domain={[0, 11]} ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} width={20} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="srpe_value" name="sRPE" stroke="#6B7280" strokeWidth={2} dot={{ r: 3, fill: "#6B7280" }} connectNulls={true} isAnimationActive={!prefersReducedMotion} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 2. Um gráfico por dimensão ── */}
      {visibleDimensions.map((dim) => (
        <div key={dim.key} role="img" aria-label={`Gráfico de ${dim.label} — ${playerName}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dim.color }} aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">{dim.label}</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} />
              <YAxis domain={[0.5, 5.5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} width={20} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey={dim.key} name={dim.label} stroke={dim.color} strokeWidth={2} dot={{ r: 3, fill: dim.color }} connectNulls={true} isAnimationActive={!prefersReducedMotion} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}

      {/* ── 3. Barras acumuladas: pré | pós por sessão, sessões separadas ── */}
      <div role="img" aria-label={`Gráfico de barras acumuladas — ${playerName}`}>
        <div className="mb-2">
          <span className="text-sm font-medium text-foreground">Acumulado por sessão</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}
            barCategoryGap="25%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="sessionLabel" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} width={20} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, name: any) => {
                const isPost = (name as string).startsWith("post_");
                const dimKey = (name as string).replace(/^(pre|post)_/, "") as DimensionKey;
                const dimLabel = DIMENSIONS.find((d) => d.key === dimKey)?.label ?? dimKey;
                return [v ?? "—", `${isPost ? "Pós" : "Pré"} · ${dimLabel}`];
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              contentStyle={{ fontSize: 11 } as any}
            />
            <Legend
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(name: any) => {
                const isPost = (name as string).startsWith("post_");
                const dimKey = (name as string).replace(/^(pre|post)_/, "") as DimensionKey;
                const dimLabel = DIMENSIONS.find((d) => d.key === dimKey)?.label ?? dimKey;
                return `${isPost ? "Pós" : "Pré"} · ${dimLabel}`;
              }}
              wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
              iconType="square"
            />
            {/* Pilha Pré */}
            {visibleDimensions.map((dim) => (
              <Bar key={`pre_${dim.key}`} dataKey={`pre_${dim.key}`} name={`pre_${dim.key}`}
                stackId="pre" fill={dim.color} fillOpacity={0.5}
                isAnimationActive={!prefersReducedMotion} />
            ))}
            {/* Pilha Pós */}
            {visibleDimensions.map((dim) => (
              <Bar key={`post_${dim.key}`} dataKey={`post_${dim.key}`} name={`post_${dim.key}`}
                stackId="post" fill={dim.color} fillOpacity={1}
                isAnimationActive={!prefersReducedMotion} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Barras transparentes = pré-sessão · Barras sólidas = pós-sessão
        </p>
      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .recharts-line-curve { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
