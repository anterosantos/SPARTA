"use client";

import { useEffect, useState } from "react";
import { PlayCircle, Hourglass } from "lucide-react";
import {
  deriveMatchPhase,
  formatMatchClock,
  HALF_TIME_BREAK_SECONDS,
  type MatchPhaseMarkers,
} from "@/lib/utils/match-clock";
import { cn } from "@/lib/utils";

interface MatchClockProps {
  markers: MatchPhaseMarkers;
  onStartMatch: () => void;
  onEndFirstHalf: () => void;
  onStartSecondHalf: () => void;
  isBusy?: boolean;
}

/**
 * Cronómetro em directo, sempre visível no topo da captura de eventos.
 * Fases: por iniciar → 1ª parte (a contar) → intervalo (contagem decrescente
 * de 15 min, passa a "+mm:ss" se o intervalo se alongar) → 2ª parte (a contar).
 * A hora de referência de cada fase vem sempre de `markers` (persistido em
 * match_events) — nunca de estado só do cliente, para sobreviver a um refresh.
 */
export function MatchClock({
  markers,
  onStartMatch,
  onEndFirstHalf,
  onStartSecondHalf,
  isBusy = false,
}: MatchClockProps) {
  const phase = deriveMatchPhase(markers);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phase === "not_started") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  let phaseLabel = "";
  let display = "";
  let isOvertimeBreak = false;

  if (phase === "first_half" && markers.matchStartAt) {
    const elapsed = (now - new Date(markers.matchStartAt).getTime()) / 1000;
    phaseLabel = "1ª parte";
    display = formatMatchClock(elapsed);
  } else if (phase === "break" && markers.firstHalfEndAt) {
    const elapsed = (now - new Date(markers.firstHalfEndAt).getTime()) / 1000;
    const remaining = HALF_TIME_BREAK_SECONDS - elapsed;
    isOvertimeBreak = remaining < 0;
    phaseLabel = "Intervalo";
    display = isOvertimeBreak ? `+${formatMatchClock(-remaining)}` : formatMatchClock(remaining);
  } else if (phase === "second_half" && markers.secondHalfStartAt) {
    const elapsed = (now - new Date(markers.secondHalfStartAt).getTime()) / 1000;
    phaseLabel = "2ª parte";
    display = formatMatchClock(elapsed);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b px-4 py-2.5 min-h-[56px]",
        isOvertimeBreak
          ? "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-800"
          : "bg-slate-900 dark:bg-slate-950 border-slate-800"
      )}
    >
      {phase === "not_started" ? (
        <span className="text-sm font-medium text-slate-300">Jogo por iniciar</span>
      ) : (
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide shrink-0",
              isOvertimeBreak ? "text-amber-800 dark:text-amber-300" : "text-slate-300"
            )}
          >
            {phaseLabel}
          </span>
          <span
            className={cn(
              "font-mono text-xl font-bold tabular-nums",
              isOvertimeBreak ? "text-amber-800 dark:text-amber-300" : "text-white"
            )}
            role="timer"
            aria-label={`${phaseLabel}: ${display}`}
          >
            {display}
          </span>
        </div>
      )}

      {phase === "not_started" && (
        <button
          type="button"
          onClick={onStartMatch}
          disabled={isBusy}
          className="min-h-[44px] shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlayCircle className="mr-1.5 -mt-0.5 inline w-4 h-4" aria-hidden />
          Iniciar jogo
        </button>
      )}
      {phase === "first_half" && (
        <button
          type="button"
          onClick={onEndFirstHalf}
          disabled={isBusy}
          className="min-h-[44px] shrink-0 rounded-lg bg-slate-700 px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Hourglass className="mr-1.5 -mt-0.5 inline w-4 h-4" aria-hidden />
          Fim da 1ª parte
        </button>
      )}
      {phase === "break" && (
        <button
          type="button"
          onClick={onStartSecondHalf}
          disabled={isBusy}
          className="min-h-[44px] shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlayCircle className="mr-1.5 -mt-0.5 inline w-4 h-4" aria-hidden />
          Iniciar 2ª parte
        </button>
      )}
      {/* 2ª parte: sem botão de fase aqui — encerrar o jogo é a ação já existente (ícone bandeira) */}
    </div>
  );
}
