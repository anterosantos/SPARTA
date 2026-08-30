"use client";

import { useState } from "react";
import {
  XCircle,
  RefreshCw,
  Target,
  Crosshair,
  ArrowRight,
  Shield,
  ShieldCheck,
  Zap,
  Goal,
  SquareX,
  Flag,
  DoorOpen,
  DoorClosed,
  Timer,
  Hourglass,
} from "lucide-react";
import type { RecentEventEntry, MatchAction } from "@/lib/stores/match-session";
import type { MATCH_ZONES } from "@/lib/schemas/match-events";
import { TooltipExplain } from "@/components/ui/tooltip-explain";

const ACTION_ICON: Record<MatchAction, React.ElementType> = {
  ball_loss: XCircle,
  ball_recovery: RefreshCw,
  shot_total: Target,
  shot_on_target: Crosshair,
  pass_completed: ArrowRight,
  def_pressure: Shield,
  def_action_success: ShieldCheck,
  off_action_success: Zap,
  // Sprint 1.5
  goal: Goal,
  card: SquareX,
  corner: Flag,
  entry_opp_area: DoorOpen,
  entry_own_area: DoorClosed,
  match_time_record: Timer,
  half_time: Hourglass,
};

const ACTION_LABEL: Record<MatchAction, string> = {
  ball_loss: "Perda de bola",
  ball_recovery: "Recuperação de bola",
  shot_total: "Remate",
  shot_on_target: "Remate à baliza",
  pass_completed: "Passe completado",
  def_pressure: "Pressão defensiva",
  def_action_success: "Ação defensiva",
  off_action_success: "Ação ofensiva",
  // Sprint 1.5
  goal: "Golo",
  card: "Cartão",
  corner: "Canto",
  entry_opp_area: "Entrada área adv.",
  entry_own_area: "Entrada nossa área",
  match_time_record: "Tempos de jogo",
  half_time: "Intervalo",
};

const ZONE_ABBR: Record<(typeof MATCH_ZONES)[number], string> = {
  def_left: "DE",
  def_center: "DC",
  def_right: "DD",
  mid_def_left: "MDE",
  mid_def_center: "MDC",
  mid_def_right: "MDD",
  mid_att_left: "MOE",
  mid_att_center: "MOC",
  mid_att_right: "MOD",
  att_left: "AE",
  att_center: "AC",
  att_right: "AD",
};

const ZONE_LABEL: Record<(typeof MATCH_ZONES)[number], string> = {
  def_left: "Defesa esquerda",
  def_center: "Defesa centro",
  def_right: "Defesa direita",
  mid_def_left: "MC defensivo esq.",
  mid_def_center: "MC defensivo centro",
  mid_def_right: "MC defensivo dir.",
  mid_att_left: "MC ofensivo esq.",
  mid_att_center: "MC ofensivo centro",
  mid_att_right: "MC ofensivo dir.",
  att_left: "Ataque esquerda",
  att_center: "Ataque centro",
  att_right: "Ataque direita",
};

interface EventChipProps {
  entry: RecentEventEntry;
  onDelete: (id: string) => Promise<void>;
  isDeleting: boolean;
  isWithinEditWindow?: boolean;
}

export function EventChip({ entry, onDelete, isDeleting, isWithinEditWindow = true }: EventChipProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const Icon = ACTION_ICON[entry.action];
  const zoneAbbr = ZONE_ABBR[entry.zone];
  const actionLabel = ACTION_LABEL[entry.action];
  const zoneLabel = ZONE_LABEL[entry.zone];
  const jerseyDisplay = entry.jersey_number !== null ? `#${entry.jersey_number}` : "ADV";

  const chipAriaLabel = `${actionLabel}, ${jerseyDisplay}, ${zoneLabel}`;
  const deleteAriaLabel = `Remover evento: ${actionLabel} ${jerseyDisplay} ${zoneLabel}`;

  if (isConfirming) {
    return (
      <div
        className="flex items-center gap-1 px-2 py-1 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 min-h-[44px]"
        aria-label={chipAriaLabel}
      >
        <span className="text-xs font-mono text-red-700 dark:text-red-300 whitespace-nowrap">
          Remover evento?
        </span>
        <button
          onClick={async () => {
            try {
              setIsConfirming(false);
              await onDelete(entry.id);
            } catch (err) {
              console.error("Delete failed:", err);
              setIsConfirming(true);
            }
          }}
          disabled={isDeleting}
          className="px-2 py-0.5 text-xs rounded bg-red-600 text-white font-medium"
          aria-label="Remover"
        >
          Remover
        </button>
        <button
          onClick={() => setIsConfirming(false)}
          className="px-2 py-0.5 text-xs rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Cancelar"
        >
          Cancelar
        </button>
      </div>
    );
  }

  const chipButton = (
    <button
      onClick={() => isWithinEditWindow && setIsConfirming(true)}
      disabled={isDeleting || !isWithinEditWindow}
      aria-label={deleteAriaLabel}
      className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 min-h-[44px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="font-mono text-xs whitespace-nowrap">
        {jerseyDisplay} {zoneAbbr}
      </span>
    </button>
  );

  if (!isWithinEditWindow) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        {chipButton}
        <TooltipExplain
          term="Edição encerrada"
          definition="Janela de edição encerrada (24h após a sessão)"
        />
      </div>
    );
  }

  return chipButton;
}
