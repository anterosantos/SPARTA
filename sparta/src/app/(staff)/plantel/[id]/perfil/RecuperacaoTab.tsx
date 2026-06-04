"use client";

import { useState, useEffect } from "react";
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
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";
import { getPlayerRecoveryTabData } from "@/lib/actions/player-profile";
import { EmptyState } from "@/components/ui/empty-state";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import type { RecoveryCurveResult } from "@/lib/readiness/recovery";

const DIMENSIONS = [
  { key: "energy",   label: "Energia",           color: "#3b82f6" },
  { key: "focus",    label: "Concentração",       color: "#8b5cf6" },
  { key: "mood",     label: "Estado emocional",   color: "#22c55e" },
  { key: "sleep",    label: "Sono",               color: "#06b6d4" },
  { key: "soreness", label: "Dor muscular",       color: "#f97316" },
] as const;

type DimKey = (typeof DIMENSIONS)[number]["key"];

const DAY_LABELS: Record<number, string> = {
  0: "Dia 0",
  1: "Dia 1",
  2: "Dia 2",
  3: "Dia 3",
};

interface RecuperacaoTabProps {
  playerId: string;
}

export function RecuperacaoTab({ playerId }: RecuperacaoTabProps) {
  const [result, setResult] = useState<RecoveryCurveResult | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      const res = await getPlayerRecoveryTabData(playerId);
      if (controller.signal.aborted) return;
      if (res.ok) {
        setResult(res.data.result);
        setPlayerName(res.data.playerName);
      } else {
        setError(res.error.message);
      }
      setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [playerId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} role="status" aria-label="A carregar..."
            className="animate-pulse rounded-lg bg-muted h-40" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive" role="alert">{error}</p>;
  }

  if (!result || result.sampleSize < 5) {
    return (
      <EmptyState
        icon={<Activity className="h-8 w-8 text-muted-foreground" />}
        title="Sem amostra suficiente"
        description="Precisamos de 5+ sessões intensas com questionário pós-sessão para traçar a curva."
      />
    );
  }

  const chartData = result.points.map((p) => ({
    day: DAY_LABELS[p.day] ?? `Dia ${p.day}`,
    energy:   p.dimensions.energy,
    focus:    p.dimensions.focus,
    sleep:    p.dimensions.sleep,
    soreness: p.dimensions.soreness,
    mood:     p.dimensions.mood,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">Curva de Recuperação</h3>
        <TooltipExplain
          term="?"
          definition={`Esta curva mostra como ${playerName} recupera nos dias após um treino intenso. Use para calibrar a próxima sessão.`}
        />
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        n={result.totalHighIntensitySessions} sessões intensas analisadas
      </p>

      {/* 5 gráficos individuais — 2 colunas em desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DIMENSIONS.map(({ key, label, color }) => (
          <div key={key} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis domain={[1, 10]} tick={{ fontSize: 10 }} ticks={[1, 4, 7, 10]} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [v ?? "—", label] as any}
                  labelStyle={{ fontSize: 11 }}
                  contentStyle={{ fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey={key as DimKey}
                  stroke={color}
                  dot={{ r: 4, fill: color }}
                  strokeWidth={2}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* Gráfico de barras acumulado — todas as dimensões por dia */}
      <div className="rounded-lg border border-border bg-card p-3">
        <h4 className="text-sm font-medium text-foreground mb-3">Acumulado por dia</h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, name: any) => [v ?? "—", DIMENSIONS.find((d) => d.key === name)?.label ?? name] as any}
              contentStyle={{ fontSize: 11 }}
            />
            <Legend
              formatter={(name) => DIMENSIONS.find((d) => d.key === name)?.label ?? name}
              wrapperStyle={{ fontSize: 11 }}
            />
            {DIMENSIONS.map(({ key, color }) => (
              <Bar key={key} dataKey={key} stackId="a" fill={color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
