"use client";

import { layoutByPosition } from "@/lib/field-layout";
import { makeHeatScale } from "@/lib/heat-scale";
import { FootballPitchSvg } from "@/components/ui/football-pitch-svg";
import type { PlayerFormationItem } from "@/lib/actions/team-aggregate";

export interface TeamWeightFormationProps {
  players: PlayerFormationItem[];
}

// Intervalo de peso (kg) usado para escalar o tamanho e a cor das bolas —
// gama visual (não a validação de PlayerMetricCreateSchema, que aceita até
// 150 kg) escolhida para diferenciar melhor os pesos reais do plantel.
// Valores fora do intervalo ficam com o tamanho/cor do limite mais próximo.
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 110;

const WEIGHT_SCALE = makeHeatScale(MIN_WEIGHT_KG, MAX_WEIGHT_KG);
export const weightToSizePx = WEIGHT_SCALE.toSizePx;
export const weightToColor = WEIGHT_SCALE.toColor;

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
    <div className="w-full space-y-3">
      <div className="relative w-full" style={{ paddingBottom: "133%" }}>
        <FootballPitchSvg ariaLabel="Campo de futebol — jogadores por posição, tamanho e cor representam o peso" />

        {positioned.map(({ item: player, xPct, yPct }) => {
          const sizePx = weightToSizePx(player.weightKg);
          const color = weightToColor(player.weightKg);
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
                className={`rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                  player.hasWeightReading ? "border-2 border-white" : "border-2 border-dashed border-white/80"
                }`}
                style={{ width: sizePx, height: sizePx, fontSize: Math.max(9, sizePx * 0.3), backgroundColor: color }}
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

      {/* Legenda da escala de cor/tamanho */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{MIN_WEIGHT_KG} kg</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{ background: WEIGHT_SCALE.legendGradient }}
          aria-hidden="true"
        />
        <span>{MAX_WEIGHT_KG} kg</span>
      </div>
    </div>
  );
}
