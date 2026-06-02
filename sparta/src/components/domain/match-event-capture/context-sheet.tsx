"use client";

import { useState } from "react";
import type { ContextAction, GoalContext, CardContext } from "@/lib/schemas/match-events";

interface ContextSheetProps {
  action: ContextAction;
  onConfirm: (context: GoalContext | CardContext) => void;
  onCancel: () => void;
}

export function ContextSheet({ action, onConfirm, onCancel }: ContextSheetProps) {
  const [period, setPeriod] = useState<1 | 2>(1);

  // Goal state
  const [playType, setPlayType] = useState<GoalContext["play_type"]>("open_play");
  const [team, setTeam] = useState<GoalContext["team"]>("own");

  // Card state
  const [cardType, setCardType] = useState<CardContext["card_type"]>("yellow");
  const [infraction, setInfraction] = useState<CardContext["infraction_type"]>("foul");

  const handleConfirm = () => {
    if (action === "goal") {
      onConfirm({ play_type: playType, period, team });
    } else {
      onConfirm({ card_type: cardType, infraction_type: infraction, period });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label={action === "goal" ? "Contexto do golo" : "Contexto do cartão"}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div className="relative w-full rounded-t-2xl bg-background p-4 pb-safe-area-inset-bottom shadow-2xl">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          {action === "goal" ? "Detalhe do golo" : "Detalhe do cartão"}
        </h2>

        {/* Período */}
        <div className="mb-4 flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Período</span>
          <div className="flex gap-2" role="group" aria-label="Período">
            {([1, 2] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={[
                  "min-h-[44px] flex-1 rounded-lg border text-sm font-medium transition-colors",
                  period === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                ].join(" ")}
              >
                {p}.ª parte
              </button>
            ))}
          </div>
        </div>

        {/* Campos específicos por tipo */}
        {action === "goal" ? (
          <>
            <div className="mb-4 flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Tipo de jogada</span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de jogada">
                {(
                  [
                    { value: "open_play", label: "Jogada corrida" },
                    { value: "corner", label: "Canto" },
                    { value: "free_kick", label: "Livre direto" },
                    { value: "other", label: "Outro" },
                  ] as { value: GoalContext["play_type"]; label: string }[]
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPlayType(value)}
                    aria-pressed={playType === value}
                    className={[
                      "min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      playType === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Equipa</span>
              <div className="flex gap-2" role="group" aria-label="Equipa">
                {(
                  [
                    { value: "own", label: "Nossa equipa" },
                    { value: "opponent", label: "Adversário" },
                  ] as { value: GoalContext["team"]; label: string }[]
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTeam(value)}
                    aria-pressed={team === value}
                    className={[
                      "min-h-[44px] flex-1 rounded-lg border text-sm font-medium transition-colors",
                      team === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Tipo de cartão</span>
              <div className="flex gap-2" role="group" aria-label="Tipo de cartão">
                <button
                  type="button"
                  onClick={() => setCardType("yellow")}
                  aria-pressed={cardType === "yellow"}
                  className={[
                    "min-h-[44px] flex-1 rounded-lg border text-sm font-semibold transition-colors",
                    cardType === "yellow"
                      ? "border-yellow-500 bg-yellow-400 text-yellow-900"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  Amarelo
                </button>
                <button
                  type="button"
                  onClick={() => setCardType("red")}
                  aria-pressed={cardType === "red"}
                  className={[
                    "min-h-[44px] flex-1 rounded-lg border text-sm font-semibold transition-colors",
                    cardType === "red"
                      ? "border-red-600 bg-red-500 text-white"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  Vermelho
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Tipo de infração</span>
              <div className="flex gap-2" role="group" aria-label="Tipo de infração">
                {(
                  [
                    { value: "foul", label: "Falta" },
                    { value: "verbal", label: "Verbal" },
                  ] as { value: CardContext["infraction_type"]; label: string }[]
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setInfraction(value)}
                    aria-pressed={infraction === value}
                    className={[
                      "min-h-[44px] flex-1 rounded-lg border text-sm font-medium transition-colors",
                      infraction === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Ações */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="min-h-[44px] flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
