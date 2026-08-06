"use client";

import { layoutByPosition, spreadHorizontal } from "@/lib/field-layout";
import { FootballPitchSvg } from "@/components/ui/football-pitch-svg";
import type { PlayerReadinessData } from "@/types/supabase";

export { spreadHorizontal };

export interface FieldFormationProps {
  players: PlayerReadinessData[];
  onSelectPlayer: (p: PlayerReadinessData) => void;
  onSelectPosition?: (positionKey: string, players: PlayerReadinessData[]) => void;
  flashedIds?: Set<string>;
}

export const STATE_COLORS: Record<string, string> = {
  ready:   '#22c55e',
  caution: '#eab308',
  alert:   '#ef4444',
  neutral: '#6b7280',
};

export const STATE_LABELS: Record<string, string> = {
  ready:   'Pronto',
  caution: 'Cuidado',
  alert:   'Alerta',
  neutral: 'Sem dados',
};

function isValidState(state: unknown): state is keyof typeof STATE_COLORS {
  return typeof state === 'string' && state in STATE_COLORS;
}

type PlayerWithCoords = { player: PlayerReadinessData; xPct: number; yPct: number; positionKey: string };

export function layoutPlayers(players: PlayerReadinessData[]): PlayerWithCoords[] {
  return layoutByPosition(players, (p) => p.primaryPosition ?? null).map(
    ({ item, xPct, yPct, positionKey }) => ({ player: item, xPct, yPct, positionKey })
  );
}

export function FieldFormation({ players, onSelectPlayer, onSelectPosition, flashedIds }: FieldFormationProps) {
  if (players.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-12 text-sm text-muted-foreground">
        Sem jogadores no plantel
      </div>
    );
  }

  const positioned = layoutPlayers(players);

  if (positioned.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-12 text-sm text-destructive">
        Erro ao posicionar jogadores no campo. Tenta novamente.
      </div>
    );
  }

  const positionGroups = new Map<string, PlayerReadinessData[]>();
  for (const { player, positionKey } of positioned) {
    const existing = positionGroups.get(positionKey);
    if (existing) {
      existing.push(player);
    } else {
      positionGroups.set(positionKey, [player]);
    }
  }

  return (
    <div className="w-full">
      <div
        className="relative w-full"
        style={{ paddingBottom: '133%' }}
      >
        <FootballPitchSvg ariaLabel="Campo de futebol — jogadores por posição" />

        {positioned.map(({ player, xPct, yPct, positionKey }) => {
          const stateColor = isValidState(player.state) ? STATE_COLORS[player.state] : STATE_COLORS['neutral'];
          const stateLabel = isValidState(player.state) ? STATE_LABELS[player.state] : 'Sem dados';
          const firstName = (player.playerName?.trim() || 'Jogador').split(' ')[0] ?? 'Jogador';
          const acwrLabel = player.acwr != null
            ? player.acwr.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : 'indisponível';
          const isFlashed = flashedIds?.has(player.player_id) ?? false;

          return (
            <button
              key={player.player_id}
              type="button"
              className={`absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2 touch-manipulation${
                isFlashed
                  ? " motion-safe:ring-2 motion-safe:ring-primary motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out"
                  : ""
              }`}
              data-flashed={isFlashed ? "true" : undefined}
              style={{ left: `${xPct}%`, top: `${yPct}%` }}
              onClick={() => {
                if (onSelectPosition) {
                  onSelectPosition(positionKey, positionGroups.get(positionKey) ?? [player]);
                } else {
                  onSelectPlayer(player);
                }
              }}
              aria-label={`Estado: ${stateLabel}, ${player.playerName}, ${player.primaryPosition ?? 'posição desconhecida'}, ACWR ${acwrLabel}`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-md"
                style={{ backgroundColor: stateColor }}
              >
                {player.jerseyNum != null ? player.jerseyNum : '?'}
              </div>
              <span className="text-white text-[9px] font-medium drop-shadow-sm max-w-[40px] truncate">
                {firstName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
