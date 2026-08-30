"use client";

import { useMemo, useState } from "react";
import type { MatchSummaryActionTotal } from "@/lib/actions/match-summary";
import { ZoneMiniPitch } from "./zone-mini-pitch";

interface TeamStatsGridProps {
  stats: MatchSummaryActionTotal[];
}

export function TeamStatsGrid({ stats }: TeamStatsGridProps) {
  const [selected, setSelected] = useState<MatchSummaryActionTotal | null>(null);

  const zoneCounts = useMemo(() => {
    if (!selected) return {};
    const counts: Partial<Record<string, number>> = {};
    for (const ev of selected.events) {
      counts[ev.zone] = (counts[ev.zone] ?? 0) + 1;
    }
    return counts;
  }, [selected]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map((stat) => (
          <button
            key={stat.action}
            type="button"
            onClick={() => stat.count > 0 && setSelected(stat)}
            disabled={stat.count === 0}
            aria-label={`${stat.label}: ${stat.count}${stat.count > 0 ? " — ver detalhe" : ""}`}
            className={`rounded-lg border p-3 text-center min-h-[44px] transition-colors ${
              stat.positive
                ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20"
            } ${stat.count > 0 ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-70"}`}
          >
            <p className="text-xl font-bold text-foreground tabular-nums">{stat.count}</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {stat.label}
            </p>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhe de ${selected.label}`}
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />
          <div className="relative w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl bg-background p-4 pb-safe-area-inset-bottom shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="text-base font-semibold text-foreground">
                {selected.label} ({selected.count})
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Fechar"
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border overflow-y-auto flex-1 min-h-0">
              {selected.events.map((ev, i) => (
                <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">
                    {ev.jerseyNum != null && (
                      <span className="tabular-nums text-muted-foreground mr-2">
                        {ev.jerseyNum}
                      </span>
                    )}
                    {ev.playerName ?? "Adversário"}
                  </span>
                  <ZoneMiniPitch highlightZone={ev.zone} size="sm" />
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-3 border-t border-border flex flex-col items-center gap-2 shrink-0">
              <p className="text-xs font-medium text-muted-foreground">Distribuição por zona</p>
              <ZoneMiniPitch counts={zoneCounts} size="lg" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
