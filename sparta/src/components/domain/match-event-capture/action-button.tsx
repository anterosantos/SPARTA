"use client";

import { forwardRef } from "react";
import {
  RotateCcw,
  Zap,
  Target,
  Crosshair,
  TrendingUp,
  Shield,
  CheckCircle,
  ArrowUpRight,
  Goal,
  SquareX,
  Flag,
  DoorOpen,
  DoorClosed,
  Hourglass,
} from "lucide-react";
import type { MatchAction } from "@/lib/stores/match-session";
import { MATCH_ACTION_INFO } from "@/lib/schemas/match-events";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  action: MatchAction;
  onClick?: (action: MatchAction) => void;
}

// Etiqueta e polaridade vêm de MATCH_ACTION_INFO (lib/schemas/match-events.ts) — fonte
// única partilhada com o resumo do jogo. Só o ícone (componente React) é local.
const ACTION_ICONS: Record<MatchAction, React.ComponentType<{ className?: string }>> = {
  ball_loss: RotateCcw,
  ball_recovery: Zap,
  shot_total: Target,
  shot_on_target: Crosshair,
  pass_completed: TrendingUp,
  def_pressure: Shield,
  def_action_success: CheckCircle,
  off_action_success: ArrowUpRight,
  goal: Goal,
  card: SquareX,
  corner: Flag,
  entry_opp_area: DoorOpen,
  entry_own_area: DoorClosed,
  match_time_record: Target,
  half_time: Hourglass,
};

export const ActionButton = forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(({ action, onClick }, ref) => {
  const actionInfo = MATCH_ACTION_INFO[action];
  const Icon = ACTION_ICONS[action];
  if (!actionInfo || !Icon) return null;

  const { label, positive } = actionInfo;
  const color = positive
    ? "border-l-emerald-500"
    : "border-l-red-500";

  return (
    <button
      ref={ref}
      onClick={() => onClick?.(action)}
      aria-label={label}
      className={cn(
        "w-full h-full rounded-lg border-l-4 border-r border-t border-b border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-t-slate-700 dark:border-r-slate-700 dark:border-b-slate-700 flex flex-col items-center justify-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer",
        color
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs text-center font-medium px-2 line-clamp-2">
        {label}
      </span>
    </button>
  );
});

ActionButton.displayName = "ActionButton";
