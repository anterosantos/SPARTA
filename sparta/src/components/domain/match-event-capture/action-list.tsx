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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Selecione uma ação</h2>

      <div className="grid grid-cols-2 gap-4">
        {STANDARD_ACTIONS.map((action) => (
          <ActionButton
            key={action}
            action={action}
            onClick={() => setSelectedAction(action)}
          />
        ))}
      </div>

      {/* Eventos especiais — Sprint 1.5 */}
      <div className="border-t border-border pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3,theme(colors.gray.500))]">
          Eventos especiais
        </p>
        <div className="grid grid-cols-2 gap-4">
          {EXTENDED_ACTIONS.map((action) => (
            <ActionButton
              key={action}
              action={action}
              onClick={() => setSelectedAction(action)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
