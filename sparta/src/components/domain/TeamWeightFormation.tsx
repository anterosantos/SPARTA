"use client";

import { layoutByPosition } from "@/lib/field-layout";
import { FootballPitchSvg } from "@/components/ui/football-pitch-svg";
import type { PlayerFormationItem } from "@/lib/actions/team-aggregate";

export interface TeamWeightFormationProps {
  players: PlayerFormationItem[];
}

// Intervalo de peso (kg) usado para escalar o tamanho das bolas — alinhado
// com os limites min/max aceites em PlayerMetricCreateSchema.
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 150;
const MIN_SIZE_PX = 24;
const MAX_SIZE_PX = 64;

export function weightToSizePx(weightKg: number): number {
  const clamped = Math.max(MIN_WEIGHT_KG, Math.min(MAX_WEIGHT_KG, weightKg));
  const t = (clamped - MIN_WEIGHT_KG) / (MAX_WEIGHT_KG - MIN_WEIGHT_KG);
  return Math.round(MIN_SIZE_PX + t * (MAX_SIZE_PX - MIN_SIZE_PX));
}

export function layoutSquad(players: PlayerFormationItem[]) {
  return layoutByPosition(players, (p) => p.position);
}

export function TeamWeightFormation({ players }: TeamWeightFormationProps) {
  if (players.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-12 text-sm text-muted-foreground">
        Sem jogadores no plantel
      </div>
    );
  }

  const positioned = layoutSquad(players);

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ paddingBottom: "133%" }}>
        <FootballPitchSvg ariaLabel="Campo de futebol — jogadores por posição, tamanho representa o peso" />

        {positioned.map(({ item: player, xPct, yPct }) => {
          const sizePx = weightToSizePx(player.weightKg);
          const firstName = (player.playerName.trim() || "Jogador").split(" ")[0] ?? "Jogador";
          const weightLabel = player.weightKg.toLocaleString("pt-PT", {
            maximumFractionDigits: 1,
          });

          return (
            <div
              key={player.playerId}
              className="absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${xPct}%`, top: `${yPct}%` }}
            >
              <div
                className="rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md bg-primary"
                style={{ width: sizePx, height: sizePx, fontSize: Math.max(9, sizePx * 0.3) }}
                title={`${player.playerName} — ${weightLabel} kg${player.hasWeightReading ? "" : " (sem leitura, valor por omissão)"}`}
                aria-label={`${player.playerName}, ${player.position ?? "posição desconhecida"}, ${weightLabel} kg${player.hasWeightReading ? "" : " (peso por omissão, sem leitura registada)"}`}
              >
                {player.jerseyNum != null ? player.jerseyNum : "?"}
              </div>
              <span className="text-white text-[9px] font-medium drop-shadow-sm max-w-[48px] truncate">
                {firstName}
              </span>
              <span
                className={`text-[9px] font-medium drop-shadow-sm ${player.hasWeightReading ? "text-white" : "text-white/70 italic"}`}
              >
                {weightLabel} kg
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
