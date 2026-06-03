"use client";

import { UserRoundX } from "lucide-react";
import { ActionButton } from "./action-button";
import { useMatchSession } from "@/lib/stores/match-session";

// Ações originais (Story 6.2)
const STANDARD_ACTIONS = [
  "ball_loss",
  "ball_recovery",
  "shot_total",
  "shot_on_target",
  "pass_completed",
  "def_pressure",
  "def_action_success",
  "off_action_success",
] as const;

// Novos tipos Sprint 1.5 (FR27a–FR27d, FR31a)
const EXTENDED_ACTIONS = [
  "goal",
  "card",
  "corner",
  "entry_opp_area",
  "entry_own_area",
] as const;

export function ActionList() {
  const setSelectedAction = useMatchSession((s) => s.setSelectedAction);
  const clearSelection = useMatchSession((s) => s.clearSelection);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-1.5 p-2 sm:p-3">
      {/* Standard actions — 8 buttons = 4 rows → flex-[4] */}
      <div className="flex-[4] min-h-0 grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
        {STANDARD_ACTIONS.map((action) => (
          <ActionButton
            key={action}
            action={action}
            onClick={() => setSelectedAction(action)}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="flex items-center gap-2 shrink-0 py-0.5">
        <div className="flex-1 border-t border-border" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
          Eventos especiais
        </span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Extended actions — 5 buttons + 1 change-player = 3 rows → flex-[3] */}
      <div className="flex-[3] min-h-0 grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
        {EXTENDED_ACTIONS.map((action) => (
          <ActionButton
            key={action}
            action={action}
            onClick={() => setSelectedAction(action)}
          />
        ))}
        {/* Célula 6 — trocar jogador (accent amarelo) */}
        <button
          type="button"
          onClick={clearSelection}
          aria-label="Trocar jogador"
          className="w-full h-full rounded-lg border-l-4 border-l-yellow-400 border-r border-t border-b border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 cursor-pointer"
        >
          <UserRoundX className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          <span className="text-xs text-center font-medium px-2 text-yellow-700 dark:text-yellow-300">
            Trocar jogador
          </span>
        </button>
      </div>
    </div>
  );
}
