"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { ZoneCell } from "./zone-cell";
import { MATCH_ZONES, requiresContext } from "@/lib/schemas/match-events";
import type { ContextAction, GoalContext, CardContext } from "@/lib/schemas/match-events";
import {
  useMatchSession,
  useSelectedPlayer,
  useSelectedAction,
  useIsOpponentEvent,
  type RecentEventEntry,
} from "@/lib/stores/match-session";
import { submitMatchEvent } from "@/lib/actions/events";
import { newId } from "@/lib/uuid";
import { enqueueMutation } from "@/lib/outbox/enqueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ContextSheet } from "./context-sheet";

const POSITIVE_ACTIONS = new Set([
  "ball_recovery",
  "shot_total",
  "shot_on_target",
  "pass_completed",
  "def_action_success",
  "off_action_success",
]);

interface ZoneSelectorSheetProps {
  sessionId: string;
  scheduledAt: string;
  durationMin: number;
}

// TODO Story 6.6+: extract helper to DRY the RecentEventEntry construction (called 3x)
function createRecentEventEntry(
  payload: ReturnType<typeof newId> extends never
    ? never
    : {
        id: string;
        action: string;
        zone: (typeof MATCH_ZONES)[number];
        player_id: string | null;
        session_id: string;
        occurred_at: string;
        captured_via: "online" | "offline-drain";
      },
  selectedAction: string,
  zone: (typeof MATCH_ZONES)[number],
  selectedPlayer: {
    jersey_number: number;
  } | null
): RecentEventEntry {
  return {
    id: payload.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: selectedAction as any,
    zone,
    jersey_number: selectedPlayer ? selectedPlayer.jersey_number : null,
    occurred_at: payload.occurred_at,
  };
}

export function ZoneSelectorSheet({ sessionId, scheduledAt, durationMin }: ZoneSelectorSheetProps) {
  const selectedPlayer = useSelectedPlayer();
  const selectedAction = useSelectedAction();
  const isOpponentEvent = useIsOpponentEvent();
  const { clearPlayer, clearSelection } = useMatchSession();
  const addRecentEvent = useMatchSession((s) => s.addRecentEvent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { isOnline } = useOnlineStatus();
  const firstCellRef = useRef<HTMLButtonElement>(null);

  // 4.º ecrã — contexto condicional para goal/card (T1.5.10)
  const [pendingZone, setPendingZone] = useState<(typeof MATCH_ZONES)[number] | null>(null);
  const showContextSheet =
    pendingZone !== null &&
    selectedAction !== null &&
    requiresContext(selectedAction);

  const isOpen =
    selectedAction !== null && (selectedPlayer !== null || isOpponentEvent);

  // Focus first zone cell when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstCellRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Submissão final com contexto opcional
  const submitEvent = async (
    zone: (typeof MATCH_ZONES)[number],
    context?: GoalContext | CardContext
  ) => {
    if (!selectedAction) return;
    if (!selectedPlayer && !isOpponentEvent) return;

    setError(null);
    setIsSubmitting(true);

    // Para sessões passadas usar o fim da sessão como timestamp; para live usar o tempo actual.
    // Evita que o server rejeite occurred_at > now por clock skew ou data posterior à sessão.
    const sessionEnd = new Date(new Date(scheduledAt).getTime() + durationMin * 60_000);
    const captureTime = new Date() > sessionEnd ? sessionEnd : new Date();

    const payload = {
      id: newId(),
      action: selectedAction,
      zone,
      player_id: selectedPlayer ? selectedPlayer.player_id : null,
      session_id: sessionId,
      occurred_at: captureTime.toISOString(),
      captured_via: isOnline ? ("online" as const) : ("offline-drain" as const),
      context: context ?? null,
    };

    try {
      if (!isOnline) {
        await enqueueMutation("match-event.submit", payload);
        if (!selectedAction) return;
        const recentEntry = createRecentEventEntry(payload, selectedAction, zone, selectedPlayer);
        addRecentEvent(recentEntry);
        const polarity = POSITIVE_ACTIONS.has(selectedAction) ? "positive" : "negative";
        startTransition(() => clearPlayer(polarity));
        return;
      }

      const result = await submitMatchEvent(payload);

      if (!result.ok) {
        // Erros transitórios (unknown) → queue para sync posterior
        // Erros de negócio (validation, not_found, forbidden) → mostrar mensagem real, não queue
        const isRetryable = result.error.code === "unknown";
        if (isRetryable) {
          await enqueueMutation("match-event.submit", { ...payload, captured_via: "offline-drain" });
          if (!selectedAction) return;
          const recentEntry = createRecentEventEntry(payload, selectedAction, zone, selectedPlayer);
          addRecentEvent(recentEntry);
          setError("Erro ao registar — evento guardado para sincronização posterior.");
        } else {
          setError(result.error.message);
        }
        return;
      }

      if (!selectedAction) return;
      const recentEntry = createRecentEventEntry(payload, selectedAction, zone, selectedPlayer);
      addRecentEvent(recentEntry);
      const polarity = POSITIVE_ACTIONS.has(selectedAction) ? "positive" : "negative";
      startTransition(() => clearPlayer(polarity));
    } catch (err) {
      try {
        await enqueueMutation("match-event.submit", { ...payload, captured_via: "offline-drain" });
        setError("Erro de rede — evento guardado para sincronização.");
      } catch {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
      setPendingZone(null);
    }
  };

  const handleZoneSelect = async (zone: (typeof MATCH_ZONES)[number]) => {
    if (!selectedAction) return;
    if (!selectedPlayer && !isOpponentEvent) return;
    if (isSubmitting) return;

    // Para goal/card: guardar zona e mostrar 4.º ecrã de contexto
    if (requiresContext(selectedAction)) {
      setPendingZone(zone);
      return;
    }

    // Para outros: submeter directamente
    await submitEvent(zone);
  };

  // Handler para confirmação do 4.º ecrã
  const handleContextConfirm = async (context: GoalContext | CardContext) => {
    if (!pendingZone) return;
    await submitEvent(pendingZone, context);
  };

  if (!isOpen) return null;

  // 4.º ecrã — ContextSheet para goal/card
  if (showContextSheet && selectedAction && requiresContext(selectedAction)) {
    return (
      <ContextSheet
        action={selectedAction as ContextAction}
        onConfirm={(ctx) => void handleContextConfirm(ctx)}
        onCancel={() => setPendingZone(null)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zone-sheet-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-border">
        <h2 id="zone-sheet-title" className="text-sm font-semibold">
          Selecione a zona
        </h2>
        <div className="flex items-center gap-2">
          {isSubmitting && (
            <span className="text-xs text-slate-500" aria-live="polite">
              Registando…
            </span>
          )}
          {error && (
            <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-[60vw]">
              {error}
            </span>
          )}
          <button
            onClick={() => { setError(null); if (!isSubmitting) clearSelection(); }}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar seletor de zona"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Zone Grid — fills remaining space */}
      <div
        className="flex-1 min-h-0 grid grid-cols-3 gap-2 p-2 sm:p-3 [grid-auto-rows:1fr]"
        role="grid"
        aria-label="Selector de zonas do campo"
      >
        {MATCH_ZONES.map((zone, i) => (
          <ZoneCell
            key={zone}
            zone={zone}
            onClick={handleZoneSelect}
            disabled={isSubmitting}
            ref={i === 0 ? firstCellRef : undefined}
          />
        ))}
      </div>
    </div>
  );
}
