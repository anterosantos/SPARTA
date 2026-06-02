"use client";

import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionHistoryBar } from "@/components/domain/readiness/session-history-bar";
import type { PlayerReadinessData, SessionHistoryEntry } from "@/types/supabase";

// Labels PT-PT para zonas de dor (abreviadas para caber no cartão)
const ZONE_LABELS: Record<string, string> = {
  head: "Cabeça",
  neck: "Pescoço", shoulder_l: "Ombro E", shoulder_r: "Ombro D",
  elbow_l: "Cotovelo E", elbow_r: "Cotovelo D",
  wrist_l: "Pulso E", wrist_r: "Pulso D",
  hand_l: "Mão E", hand_r: "Mão D",
  chest: "Peito", abdomen: "Barriga",
  back_upper: "Costas sup", back_lower: "Costas inf",
  hip_l: "Anca E", hip_r: "Anca D",
  thigh_l: "Coxa E", thigh_r: "Coxa D",
  knee_l: "Joelho E", knee_r: "Joelho D",
  calf_l: "Gémeos E", calf_r: "Gémeos D",
  ankle_l: "Tornozelo E", ankle_r: "Tornozelo D",
  achilles_l: "Aquiles E", achilles_r: "Aquiles D",
  foot_l: "Pé E", foot_r: "Pé D",
  other: "Outra zona",
};

// ─── Age group display ────────────────────────────────────────────────────────

const AGE_GROUP_LABEL: Record<string, string> = {
  senior: "Sénior",
  u19: "Sub-19",
  u17: "Sub-17",
  u15: "Sub-15",
  u14: "Sub-14",
};

function ageGroupLabel(raw: string | null): string {
  if (!raw) return "";
  return AGE_GROUP_LABEL[raw.toLowerCase()] ?? raw;
}

// ─── Readiness badge ──────────────────────────────────────────────────────────

const BADGE_CONFIG = {
  ready:   { label: "OK",        ariaLabel: "OK",        className: "bg-signal-ready/10 text-signal-ready" },
  caution: { label: "ATENÇÃO",   ariaLabel: "Atenção",   className: "bg-signal-caution/10 text-signal-caution" },
  alert:   { label: "ALERTA",    ariaLabel: "Alerta",    className: "bg-signal-alert/10 text-signal-alert" },
  neutral: { label: "—",         ariaLabel: "Sem dados", className: "bg-muted text-muted-foreground" },
} as const satisfies Record<string, { label: string; ariaLabel: string; className: string }>;

function ReadinessBadge({ state }: { state: string }) {
  const config = BADGE_CONFIG[state as keyof typeof BADGE_CONFIG] ?? BADGE_CONFIG.neutral;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium shrink-0",
        config.className
      )}
      aria-hidden="true"
    >
      <span className="text-[10px]">●</span>
      {config.label}
    </span>
  );
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

export interface PlayerRowProps {
  snapshot: PlayerReadinessData;
  history: SessionHistoryEntry[];
  position: string;
  onSelect?: (snapshot: PlayerReadinessData) => void;
  flashed?: boolean;
}

export function PlayerRow({
  snapshot,
  history,
  position,
  onSelect,
  flashed = false,
}: PlayerRowProps) {
  const { playerName, jerseyNum, state, acwr, derived_age_group, player_id, recentMusclePainZones, hasExamsThisWeek } = snapshot;
  const hasPain = recentMusclePainZones != null && recentMusclePainZones.length > 0;

  const acwrLabel = acwr != null ? `ACWR ${acwr.toFixed(2)}` : null;
  const categoryLabel = ageGroupLabel(derived_age_group);
  const subtitle = [categoryLabel, acwrLabel].filter(Boolean).join(" · ");

  const ariaLabel = [
    playerName,
    jerseyNum != null ? `Número ${String(jerseyNum)}` : null,
    `Posição ${position}`,
    `Estado ${BADGE_CONFIG[state as keyof typeof BADGE_CONFIG]?.ariaLabel ?? state}`,
    hasPain ? `Dores reportadas: ${recentMusclePainZones!.map((z) => ZONE_LABELS[z] ?? z).join(", ")}` : null,
    hasExamsThisWeek === true ? "Tem exames esta semana" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl",
        flashed && "motion-safe:bg-primary/5 motion-safe:transition-all motion-safe:duration-200"
      )}
      aria-label={ariaLabel}
      data-player-id={player_id}
      data-flashed={flashed ? "true" : undefined}
      onClick={() => onSelect?.(snapshot)}
    >
      <div className="bg-card rounded-xl shadow-sm border border-border/50 p-4 hover:shadow-md transition-shadow">
        {/* Top row: jersey | name+subtitle | badge */}
        <div className="flex items-center gap-3">
          {/* Jersey badge */}
          <div
            className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <span className="text-lg font-bold text-muted-foreground">
              {jerseyNum != null ? jerseyNum : "—"}
            </span>
          </div>

          {/* Name + subtitle */}
          <div className="flex-1 min-w-0" aria-hidden="true">
            <p className="font-semibold text-foreground truncate">{playerName}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* State badge */}
          <ReadinessBadge state={state} />
        </div>

        {/* History bar */}
        <SessionHistoryBar history={history} className="mt-3" />

        {/* Wellness indicators — dia atual ou ontem (Sprint 1.5) */}
        {(hasPain || hasExamsThisWeek === true) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-hidden="true">

            {/* Zonas de dor */}
            {hasPain && recentMusclePainZones!.map((zone) => (
              <span
                key={zone}
                className="inline-flex items-center rounded-full bg-[var(--signal-alert-bg,#FEF2F2)] px-2 py-0.5 text-[10px] font-medium text-[var(--signal-alert-ink,#991B1B)] ring-1 ring-inset ring-[var(--signal-alert-ink,#991B1B)]/20"
              >
                {ZONE_LABELS[zone] ?? zone}
              </span>
            ))}

            {/* Flag de exames */}
            {hasExamsThisWeek === true && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--signal-caution-bg,#FEFCE8)] px-2 py-0.5 text-[10px] font-medium text-[var(--signal-caution-ink,#854D0E)] ring-1 ring-inset ring-[var(--signal-caution-ink,#854D0E)]/20">
                <BookOpen size={10} />
                Exames
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
