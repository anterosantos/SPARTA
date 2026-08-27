"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { setStartingLineup } from "@/lib/actions/lineups";
import type { MatchLineupWithPlayerData } from "@/lib/actions/lineups";

const REQUIRED_STARTERS = 11;

interface StartingLineupPickerProps {
  sessionId: string;
  convocados: MatchLineupWithPlayerData[];
  onConfirmed: () => void;
}

/**
 * Passo obrigatório no início da captura de eventos: escolher os 11 titulares de
 * entre os convocados. A Convocatória já não decide isto — só define quem está
 * convocado (ver ClientConvocacaoEditor). Os restantes convocados ficam "bench"
 * (disponíveis para substituição em SubstitutionSheet).
 */
export function StartingLineupPicker({
  sessionId,
  convocados,
  onConfirmed,
}: StartingLineupPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...convocados].sort(
    (a, b) => (a.shirt_num ?? 999) - (b.shirt_num ?? 999)
  );

  function toggle(playerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else if (next.size < REQUIRED_STARTERS) {
        next.add(playerId);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size !== REQUIRED_STARTERS || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const result = await setStartingLineup({
      sessionId,
      starterPlayerIds: [...selected],
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onConfirmed();
  }

  if (convocados.length < REQUIRED_STARTERS) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Convocatória com menos de {REQUIRED_STARTERS} jogadores
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
          Só há {convocados.length} jogador(es) convocado(s). Edite a convocatória antes
          de escolher os titulares.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Seleccionar Titulares
        </h1>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"
        >
          {selected.size} / {REQUIRED_STARTERS} titulares
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sorted.map((player) => {
            const isSelected = selected.has(player.player_id);
            const atLimit = selected.size >= REQUIRED_STARTERS && !isSelected;
            return (
              <button
                key={player.player_id}
                type="button"
                onClick={() => toggle(player.player_id)}
                disabled={atLimit}
                aria-pressed={isSelected}
                className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border min-h-[44px] ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                } ${atLimit ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isSelected ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-400 flex-shrink-0" />
                )}
                <span className="text-sm font-medium tabular-nums text-slate-500 dark:text-slate-400">
                  {player.shirt_num ?? "—"}
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {player.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected.size !== REQUIRED_STARTERS || isSubmitting}
          className="w-full min-h-[44px] rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium disabled:opacity-50"
        >
          {isSubmitting ? "A confirmar..." : "Confirmar titulares"}
        </button>
      </div>
    </div>
  );
}
