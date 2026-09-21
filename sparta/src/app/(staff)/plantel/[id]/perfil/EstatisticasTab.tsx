"use client";

import { useState, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { BarChart2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SeasonToggle } from "@/components/patterns/SeasonToggle";
import { getPlayerStatisticsTabData } from "@/lib/actions/player-profile";
import { getCurrentSeason } from "@/lib/actions/seasons";
import type { StatisticsTabData } from "@/lib/actions/player-profile";
import {
  MATCH_ZONES,
  MATCH_ZONE_LABEL,
  LEGACY_MATCH_ZONES,
  LEGACY_MATCH_ZONE_LABEL,
} from "@/lib/schemas/match-events";

interface EstatisticasTabProps {
  playerId: string;
  isCumulative: boolean;
}

type SessionTypeFilter = "all" | "match" | "friendly";

const SESSION_TYPE_OPTIONS: { value: SessionTypeFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "match", label: "Jogos" },
  { value: "friendly", label: "Amigáveis" },
];

function zoneColor(count: number, max: number): string {
  if (max === 0) return "bg-muted";
  const ratio = count / max;
  if (ratio >= 0.75) return "bg-signal-alert text-white";
  if (ratio >= 0.4) return "bg-signal-caution";
  if (ratio > 0) return "bg-signal-ok/40";
  return "bg-muted";
}

function per90(value: number, minutes: number): string {
  if (minutes === 0) return "—";
  return (value / (minutes / 90)).toFixed(2);
}

function formatDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "d/MM/yy", { locale: pt });
  } catch {
    return isoDate.slice(0, 10);
  }
}

export function EstatisticasTab({ playerId, isCumulative }: EstatisticasTabProps) {
  const [data, setData] = useState<StatisticsTabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null);
  const [sessionTypeFilter, setSessionTypeFilter] = useState<SessionTypeFilter>("all");
  const seasonFetchedRef = useRef(false);

  useEffect(() => {
    if (seasonFetchedRef.current) return;
    seasonFetchedRef.current = true;
    getCurrentSeason()
      .then((result) => {
        if (result.ok && result.data) setCurrentSeasonId(result.data.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      const seasonId = isCumulative ? null : currentSeasonId;
      const sessionType = sessionTypeFilter === "all" ? null : sessionTypeFilter;
      const result = await getPlayerStatisticsTabData(playerId, seasonId, sessionType);
      if (controller.signal.aborted) return;
      if (result.ok) {
        setData(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    }
    void load();

    return () => controller.abort();
  }, [playerId, isCumulative, currentSeasonId, sessionTypeFilter]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="A carregar estatísticas..."
        className="animate-pulse rounded-lg bg-muted"
        style={{ height: 200 }}
      />
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  const sessionTypeToggle = (
    <div className="flex gap-2" role="group" aria-label="Filtro por tipo de sessão">
      {SESSION_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setSessionTypeFilter(opt.value)}
          aria-pressed={sessionTypeFilter === opt.value}
          className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition-colors ${
            sessionTypeFilter === opt.value
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  if (!data || data.rows.length === 0) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <SeasonToggle isCumulative={isCumulative} />
          {sessionTypeToggle}
        </div>
        <EmptyState
          icon={<BarChart2 className="h-8 w-8 text-muted-foreground" />}
          title="Sem jogos registados"
          description="Ainda não há eventos de performance registados para este jogador."
        />
      </>
    );
  }

  const t = data.totals;
  // A vista é cumulativa — pode abranger jogos capturados antes E depois da
  // mudança para 24 zonas (2026), por isso os dois esquemas são tratados em
  // separado: jogos antigos continuam a mostrar-se com o layout de 12 zonas
  // (3×4) com que foram jogados, nunca reinterpretados como as novas 24.
  const legacyCounts = LEGACY_MATCH_ZONES.map((z) => data.zoneHeatmap[z] ?? 0);
  const maxLegacyCount = Math.max(0, ...legacyCounts);
  const hasLegacyZoneData = legacyCounts.some((c) => c > 0);

  const newCounts = MATCH_ZONES.map((z) => data.zoneHeatmap[z] ?? 0);
  const maxNewCount = Math.max(0, ...newCounts);
  const hasNewZoneData = newCounts.some((c) => c > 0);

  // Só desambiguar o título quando os dois esquemas coexistem nesta vista.
  const bothSchemesPresent = hasLegacyZoneData && hasNewZoneData;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <SeasonToggle isCumulative={isCumulative} />
        {sessionTypeToggle}
      </div>

      {/* Match stats table */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Data</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Min.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Perd.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Recup.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Rem.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Rem. Enq.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Passes</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Press. Def.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Ac. Of.</th>
              <th className="text-right py-2 font-semibold text-muted-foreground">Ac. Def.</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.session_id} className="border-b border-border last:border-0">
                <td className="py-2 pr-3">{formatDate(r.date)}</td>
                <td className="py-2 pr-3 text-right">{r.minutes_played}</td>
                <td className="py-2 pr-3 text-right">{r.losses}</td>
                <td className="py-2 pr-3 text-right">{r.recoveries}</td>
                <td className="py-2 pr-3 text-right">{r.shots}</td>
                <td className="py-2 pr-3 text-right">{r.shots_on_target}</td>
                <td className="py-2 pr-3 text-right">{r.passes}</td>
                <td className="py-2 pr-3 text-right">{r.defensive_pressures}</td>
                <td className="py-2 pr-3 text-right">{r.offensive_actions}</td>
                <td className="py-2 text-right">{r.defensive_actions}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="py-2 pr-3 text-muted-foreground">Total</td>
              <td className="py-2 pr-3 text-right">{t.minutes}</td>
              <td className="py-2 pr-3 text-right">{t.losses}<br /><span className="font-normal text-muted-foreground">{per90(t.losses, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.recoveries}<br /><span className="font-normal text-muted-foreground">{per90(t.recoveries, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.shots}<br /><span className="font-normal text-muted-foreground">{per90(t.shots, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.shots_on_target}<br /><span className="font-normal text-muted-foreground">{per90(t.shots_on_target, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.passes}<br /><span className="font-normal text-muted-foreground">{per90(t.passes, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.defensive_pressures}<br /><span className="font-normal text-muted-foreground">{per90(t.defensive_pressures, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.offensive_actions}<br /><span className="font-normal text-muted-foreground">{per90(t.offensive_actions, t.minutes)} /90</span></td>
              <td className="py-2 text-right">{t.defensive_actions}<br /><span className="font-normal text-muted-foreground">{per90(t.defensive_actions, t.minutes)} /90</span></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Zonas de acção — esquema legado (12 zonas, 3×4), jogos antigos */}
      {hasLegacyZoneData && (
        <section aria-label="Mapa de zonas de acção (esquema anterior)">
          <h3 className="text-sm font-semibold mb-2">
            Zonas de acção{bothSchemesPresent ? " (esquema anterior)" : ""}
          </h3>
          <div
            className="grid grid-cols-3 gap-1 w-48"
            role="img"
            aria-label="Grelha 3×4 de intensidade de acções por zona"
          >
            {LEGACY_MATCH_ZONES.map((zone) => {
              const count = data.zoneHeatmap[zone] ?? 0;
              const label = LEGACY_MATCH_ZONE_LABEL[zone];
              return (
                <div
                  key={zone}
                  className={`flex flex-col items-center justify-center h-14 rounded text-xs font-medium ${zoneColor(count, maxLegacyCount)}`}
                  aria-label={`Zona ${label}: ${count} acções`}
                >
                  <span className="text-[9px] text-muted-foreground text-center px-0.5 leading-tight">{label}</span>
                  <span>{count > 0 ? count : ""}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Zonas de acção — esquema actual (24 zonas, 4×6) */}
      {hasNewZoneData && (
        <section aria-label="Mapa de zonas de acção">
          <h3 className="text-sm font-semibold mb-2">
            Zonas de acção{bothSchemesPresent ? " (esquema actual)" : ""}
          </h3>
          <div
            className="grid grid-cols-4 gap-1 w-56"
            role="img"
            aria-label="Grelha 4×6 de intensidade de acções por zona"
          >
            {MATCH_ZONES.map((zone) => {
              const count = data.zoneHeatmap[zone] ?? 0;
              const label = MATCH_ZONE_LABEL[zone];
              return (
                <div
                  key={zone}
                  className={`flex flex-col items-center justify-center h-14 rounded text-xs font-medium ${zoneColor(count, maxNewCount)}`}
                  aria-label={`Zona ${label}: ${count} acções`}
                >
                  <span className="text-[8px] text-muted-foreground text-center px-0.5 leading-tight">{label}</span>
                  <span>{count > 0 ? count : ""}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
