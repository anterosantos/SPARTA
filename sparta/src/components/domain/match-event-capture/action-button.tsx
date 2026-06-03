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
} from "lucide-react";
import type { MatchAction } from "@/lib/stores/match-session";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  action: MatchAction;
  onClick?: (action: MatchAction) => void;
}

const ACTIONS_MAP: Record<
  MatchAction,
  { label: string; icon: React.ComponentType<{ className?: string }>; positive: boolean }
> = {
  // Ações originais
  ball_loss: { label: "Perda de bola", icon: RotateCcw, positive: false },
  ball_recovery: { label: "Recuperação", icon: Zap, positive: true },
  shot_total: { label: "Remate total", icon: Target, positive: true },
  shot_on_target: { label: "Remate enquadrado", icon: Crosshair, positive: true },
  pass_completed: { label: "Passe completado", icon: TrendingUp, positive: true },
  def_pressure: { label: "Pressão defensiva", icon: Shield, positive: false },
  def_action_success: { label: "Ação def. com sucesso", icon: CheckCircle, positive: true },
  off_action_success: { label: "Ação of. com sucesso", icon: ArrowUpRight, positive: true },
  // Sprint 1.5 — novos tipos
  goal: { label: "Golo", icon: Goal, positive: true },
  card: { label: "Cartão", icon: SquareX, positive: false },
  corner: { label: "Canto", icon: Flag, positive: false },
  entry_opp_area: { label: "Entrada área adversária", icon: DoorOpen, positive: true },
  entry_own_area: { label: "Entrada na nossa área", icon: DoorClosed, positive: false },
  match_time_record: { label: "Tempos de jogo", icon: Target, positive: true },
};

export const ActionButton = forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(({ action, onClick }, ref) => {
  const actionInfo = ACTIONS_MAP[action];
  if (!actionInfo) return null;

  const { label, icon: Icon, positive } = actionInfo;
  const color = positive
    ? "border-l-emerald-500"
    : "border-l-red-500";

  return (
    <button
      ref={ref}
      onClick={() => onClick?.(action)}
      aria-label={label}
      className={cn(
        "w-full h-full rounded-lg border-l-4 border-r border-t border-b border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer",
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
