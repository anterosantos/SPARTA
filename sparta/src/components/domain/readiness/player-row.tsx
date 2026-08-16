"use client";

import { BookOpen, Clock, UserX } from "lucide-react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SessionHistoryBar } from "@/components/domain/readiness/session-history-bar";
import type { PlayerReadinessData, SessionHistoryEntry } from "@/types/supabase";

// Labels PT-PT para zonas de dor (abreviadas para caber no cartão)
const ZONE_LABELS: Record<string, string> = {
  head: "Cabeça",
  neck: "Pescoço", shoulder_l: "Ombro E", shoulder_r: "Ombro D",
  upper_arm_l: "Braço E", upper_arm_r: "Braço D",
  elbow_l: "Cotovelo E", elbow_r: "Cotovelo D",
  forearm_l: "Antebraço E", forearm_r: "Antebraço D",
  wrist_l: "Pulso E", wrist_r: "Pulso D",
  hand_l: "Mão E", hand_r: "Mão D",
  chest: "Peito", abdomen: "Barriga",
  back_upper_l: "Costas sup E", back_upper_r: "Costas sup D",
  back_lower_l: "Costas inf E", back_lower_r: "Costas inf D",
  hip_l: "Anca E", hip_r: "Anca D",
  thigh_l: "Coxa E", thigh_r: "Coxa D",
  knee_l: "Joelho E", knee_r: "Joelho D",
  shin_l: "Canela E", shin_r: "Canela D",
  calf_l: "Gémeos E", calf_r: "Gémeos D",
  ankle_l: "Tornozelo E", ankle_r: "Tornozelo D",
  achilles_l: "Aquiles E", achilles_r: "Aquiles D",
  foot_l: "Pé E", foot_r: "Pé D",
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
  scheduledAt?: string;
}

export function PlayerRow({
  snapshot,
  history,
  position,
  onSelect,
  flashed = false,
  scheduledAt,
}: PlayerRowProps) {
  const { playerName, jerseyNum, state, acwr, derived_age_group, player_id, recentMusclePainZones, hasExamsThisWeek, declaredAbsent, absenceNote, lateRiskState, lateRiskExitTime } = snapshot;
  const hasPain = recentMusclePainZones != null && recentMusclePainZones.length > 0;

  const sessionLabel = scheduledAt
    ? format(parseISO(scheduledAt), "EEE d MMM · HH:mm", { locale: pt })
    : null;
  const sessionTimeLabel = scheduledAt ? format(parseISO(scheduledAt), "HH:mm") : null;

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
    declaredAbsent ? `Declarou ausência${sessionLabel ? ` — ${sessionLabel}` : ""}` : null,
    lateRiskState === "missing" ? "Horário de saída em falta" : null,
    lateRiskState === "alert"
      ? `Risco de atraso na chegada${sessionTimeLabel ? ` à sessão das ${sessionTimeLabel}` : ""}${lateRiskExitTime ? ` — horário de saída ${lateRiskExitTime}` : ""}`
      : null,
    lateRiskState === "caution"
      ? `Chegada prevista à hora de início${sessionTimeLabel ? ` à sessão das ${sessionTimeLabel}` : ""}${lateRiskExitTime ? ` — horário de saída ${lateRiskExitTime}` : ""}`
      : null,
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

        {/* Ausência declarada pelo jogador */}
        {declaredAbsent && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-hidden="true">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-300 ring-1 ring-inset ring-orange-300 dark:ring-orange-700">
              <UserX size={10} />
              Vai faltar
            </span>
            {sessionLabel && (
              <span className="text-[10px] text-muted-foreground">{sessionLabel}</span>
            )}
            {absenceNote && (
              <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">
                &ldquo;{absenceNote}&rdquo;
              </span>
            )}
          </div>
        )}

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

        {/* Risco de atraso — horário de saída da escola (spec-horario-saida-risco-atraso) */}
        {lateRiskState != null && (
          <div className="mt-2 space-y-1" aria-hidden="true">
            <div className="flex flex-wrap items-center gap-1.5">
              {lateRiskState === "missing" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                  <Clock size={10} />
                  Horário de saída em falta
                </span>
              )}
              {lateRiskState === "alert" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--signal-alert-bg,#FEF2F2)] px-2 py-0.5 text-[10px] font-medium text-[var(--signal-alert-ink,#991B1B)] ring-1 ring-inset ring-[var(--signal-alert-ink,#991B1B)]/20">
                  <Clock size={10} />
                  Risco de atraso
                </span>
              )}
              {lateRiskState === "caution" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--signal-caution-bg,#FEFCE8)] px-2 py-0.5 text-[10px] font-medium text-[var(--signal-caution-ink,#854D0E)] ring-1 ring-inset ring-[var(--signal-caution-ink,#854D0E)]/20">
                  <Clock size={10} />
                  Chegada à hora
                </span>
              )}
              {(lateRiskState === "alert" || lateRiskState === "caution") && sessionTimeLabel && (
                <span className="text-[10px] text-muted-foreground">à sessão das {sessionTimeLabel}</span>
              )}
            </div>
            {(lateRiskState === "alert" || lateRiskState === "caution") && lateRiskExitTime && (
              <p className="text-xs text-muted-foreground pl-0.5">
                Horário de saída: {lateRiskExitTime}
              </p>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
