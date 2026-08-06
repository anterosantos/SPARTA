"use client";

import { layoutByPosition } from "@/lib/field-layout";
import { FootballPitchSvg } from "@/components/ui/football-pitch-svg";
import type { PlayerFormationItem } from "@/lib/actions/team-aggregate";

export interface TeamWeightFormationProps {
  players: PlayerFormationItem[];
}

// Intervalo de peso (kg) usado para escalar o tamanho e a cor das bolas —
// alinhado com os limites min/max aceites em PlayerMetricCreateSchema.
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 150;
const MIN_SIZE_PX = 24;
const MAX_SIZE_PX = 64;

// Escala de cor sequencial (leve → pesado), reaproveitando as cores já
// usadas para Treino/Jogo em session-colors.ts.
const COLOR_STOPS: { t: number; rgb: [number, number, number] }[] = [
  { t: 0,   rgb: [37, 99, 235] },  // blue-600 (leve)
  { t: 0.5, rgb: [245, 158, 11] }, // amber-500 (médio)
  { t: 1,   rgb: [220, 38, 38] },  // red-600 (pesado)
];

function weightToT(weightKg: number): number {
  const clamped = Math.max(MIN_WEIGHT_KG, Math.min(MAX_WEIGHT_KG, weightKg));
  return (clamped - MIN_WEIGHT_KG) / (MAX_WEIGHT_KG - MIN_WEIGHT_KG);
}

export function weightToSizePx(weightKg: number): number {
  const t = weightToT(weightKg);
  return Math.round(MIN_SIZE_PX + t * (MAX_SIZE_PX - MIN_SIZE_PX));
}

export function weightToColor(weightKg: number): string {
  const t = weightToT(weightKg);
  let lo = COLOR_STOPS[0]!;
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1]!;
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i]!;
    const b = COLOR_STOPS[i + 1]!;
    if (t >= a.t && t <= b.t) {
      lo = a;
      hi = b;
      break;
    }
  }
  const span = hi.t - lo.t || 1;
  const localT = (t - lo.t) / span;
  const r = Math.round(lo.rgb[0] + localT * (hi.rgb[0] - lo.rgb[0]));
  const g = Math.round(lo.rgb[1] + localT * (hi.rgb[1] - lo.rgb[1]));
  const b = Math.round(lo.rgb[2] + localT * (hi.rgb[2] - lo.rgb[2]));
  return `rgb(${r}, ${g}, ${b})`;
}

const LEGEND_GRADIENT = `linear-gradient(to right, ${COLOR_STOPS.map(
  (s) => `rgb(${s.rgb.join(",")}) ${s.t * 100}%`
).join(", ")})`;

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
          style={{ background: LEGEND_GRADIENT }}
          aria-hidden="true"
        />
        <span>{MAX_WEIGHT_KG} kg</span>
      </div>
    </div>
  );
}
