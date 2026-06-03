"use client";

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

      {/* Extended actions — 5 buttons = 3 rows → flex-[3] */}
      <div className="flex-[3] min-h-0 grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
        {EXTENDED_ACTIONS.map((action) => (
          <ActionButton
            key={action}
            action={action}
            onClick={() => setSelectedAction(action)}
          />
        ))}
      </div>
    </div>
  );
}
