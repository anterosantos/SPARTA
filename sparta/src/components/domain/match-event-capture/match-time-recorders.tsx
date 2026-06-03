"use client";

import { useState } from "react";
import { Timer } from "lucide-react";
import { newId } from "@/lib/uuid";
import { submitMatchEvent } from "@/lib/actions/events";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";

interface MatchTimeRecordersProps {
  sessionId: string;
  /** Duração nominal da sessão em minutos (usada como default e limite máximo) */
  durationMin: number;
  disabled?: boolean;
}

export function MatchTimeRecorders({ sessionId, durationMin, disabled = false }: MatchTimeRecordersProps) {
  const [totalMinutes, setTotalMinutes] = useState<string>("");
  const [usefulMinutes, setUsefulMinutes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const total = totalMinutes === "" ? null : parseInt(totalMinutes, 10);
  const useful = usefulMinutes === "" ? null : parseInt(usefulMinutes, 10);

  const isValid =
    total !== null && !isNaN(total) && total >= 0 && total <= 200 &&
    useful !== null && !isNaN(useful) && useful >= 0 && useful <= 200 &&
    useful <= total;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting || disabled) return;
    setIsSubmitting(true);
    setError(null);

    // match_time_record usa zone="mid_def_center" por convenção (sem zona real)
    // player_id é do primeiro jogador — mas para este tipo usamos o próprio staff
    // Nota: este evento usa a zone como placeholder; o player_id será o do staff via server action
    const result = await submitMatchEvent({
      id: newId(),
      session_id: sessionId,
      action: "match_time_record",
      zone: "mid_def_center",
      player_id: "00000000-0000-0000-0000-000000000000", // placeholder — server action ignora
      occurred_at: new Date().toISOString(),
      captured_via: "online",
      context: {
        total_minutes: total!,
        useful_minutes: useful!,
      },
    });

    if (result.ok) {
      setShowConfirmation(true);
    } else {
      setError(result.error.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <Timer size={18} className="text-[var(--color-ink-3,theme(colors.gray.500))]" aria-hidden />
        <span className="text-sm font-semibold text-foreground">
          Tempos de jogo
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Tempo total */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="total-minutes"
            className="text-xs font-medium text-[var(--color-ink-2,theme(colors.gray.600))]"
          >
            Tempo total (min)
          </label>
          <input
            id="total-minutes"
            type="number"
            min={0}
            max={200}
            value={totalMinutes}
            onChange={(e) => setTotalMinutes(e.target.value)}
            disabled={disabled || isSubmitting}
            placeholder={String(durationMin)}
            className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-center text-base font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Tempo total de jogo em minutos"
          />
        </div>

        {/* Tempo útil */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="useful-minutes"
            className="text-xs font-medium text-[var(--color-ink-2,theme(colors.gray.600))]"
          >
            Tempo útil (min)
          </label>
          <input
            id="useful-minutes"
            type="number"
            min={0}
            max={200}
            value={usefulMinutes}
            onChange={(e) => setUsefulMinutes(e.target.value)}
            disabled={disabled || isSubmitting}
            placeholder="—"
            className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-center text-base font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Tempo útil de jogo (bola em jogo) em minutos"
          />
        </div>
      </div>

      <p className="text-xs text-[var(--color-ink-3,theme(colors.gray.500))]">
        Tempo útil = tempo com bola em jogo. Deve ser ≤ tempo total.
      </p>

      {error && (
        <p role="alert" className="text-xs text-[var(--signal-alert-ink,theme(colors.red.700))]">
          {error}
        </p>
      )}

      {useful !== null && total !== null && useful > total && (
        <p role="alert" className="text-xs text-[var(--signal-alert-ink,theme(colors.red.700))]">
          Tempo útil não pode ser maior que o tempo total.
        </p>
      )}

      <button
        type="button"
        disabled={!isValid || isSubmitting || disabled}
        onClick={() => void handleSubmit()}
        className="min-h-[44px] w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "A guardar…" : "Registar tempos"}
      </button>

      {showConfirmation && (
        <CalmConfirmation
          message="Tempos registados."
          onDismiss={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
}
