"use client";

import { getPositionKey } from "@/components/domain/readiness/readiness-panel-list";
import type { PlayerReadinessData } from "@/types/supabase";

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

// Coordinates per sub-position (% of SVG viewBox 300×400, origin top-left).
// Our goal is at the bottom; attack direction is upward.
const POSITION_COORDS: Record<string, { xPct: number; yPct: number; halfSpan: number }> = {
  GR:  { xPct: 50, yPct: 89, halfSpan:  7 },
  DC:  { xPct: 50, yPct: 76, halfSpan: 10 },
  DD:  { xPct: 80, yPct: 76, halfSpan:  6 },
  DE:  { xPct: 20, yPct: 76, halfSpan:  6 },
  LIB: { xPct: 50, yPct: 69, halfSpan:  7 },
  MDC: { xPct: 50, yPct: 57, halfSpan:  7 },
  MC:  { xPct: 50, yPct: 45, halfSpan:  8 },
  MO:  { xPct: 50, yPct: 33, halfSpan:  7 },
  MD:  { xPct: 72, yPct: 45, halfSpan:  7 },
  ME:  { xPct: 28, yPct: 45, halfSpan:  7 },
  EXD: { xPct: 76, yPct: 28, halfSpan:  7 },
  EXE: { xPct: 24, yPct: 28, halfSpan:  7 },
  SC:  { xPct: 50, yPct: 20, halfSpan:  8 },
  PL:  { xPct: 50, yPct: 15, halfSpan:  7 },
};

// Fallback coordinates when primaryPosition holds a canonical group name (DEF/MED/AVA)
const FALLBACK_COORDS: Record<string, { xPct: number; yPct: number; halfSpan: number }> = {
  DEF: { xPct: 50, yPct: 76, halfSpan: 10 },
  MED: { xPct: 50, yPct: 45, halfSpan: 10 },
  AVA: { xPct: 50, yPct: 28, halfSpan: 10 },
};

const DEFAULT_COORDS = { xPct: 50, yPct: 44, halfSpan: 14 };

function getCoords(position: string | null): { xPct: number; yPct: number; halfSpan: number } {
  if (!position) return DEFAULT_COORDS;
  const trimmed = position.trim();
  if (!trimmed) return DEFAULT_COORDS;
  const upper = trimmed.toUpperCase();
  const direct = POSITION_COORDS[upper];
  if (direct) return direct;
  const group = getPositionKey(position);
  const fallback = FALLBACK_COORDS[group];
  if (!fallback) {
    console.warn(`Unknown position group for "${position}", using default centered position`);
  }
  return fallback ?? DEFAULT_COORDS;
}

// Returns a unique group key for a player — sub-position if known, canonical group otherwise.
function groupKey(position: string | null): string {
  if (!position) return 'MED';
  const upper = position.trim().toUpperCase();
  if (POSITION_COORDS[upper]) return upper;
  const canonical = getPositionKey(position);
  if (!canonical || typeof canonical !== 'string') {
    console.warn(`groupKey returned unexpected value "${canonical}" for position "${position}"`);
    return 'MED';
  }
  return canonical;
}

export function spreadHorizontal(count: number, baseXPct: number, halfSpan: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [baseXPct];
  return Array.from({ length: count }, (_, i) => {
    const x = baseXPct - halfSpan + (i * (halfSpan * 2)) / (count - 1);
    return Math.max(8, Math.min(92, x));
  });
}

type PlayerWithCoords = { player: PlayerReadinessData; xPct: number; yPct: number; positionKey: string };

export function layoutPlayers(players: PlayerReadinessData[]): PlayerWithCoords[] {
  const grouped = new Map<string, { players: PlayerReadinessData[]; xPct: number; yPct: number; halfSpan: number }>();

  for (const player of players) {
    const key = groupKey(player.primaryPosition ?? null);
    const existing = grouped.get(key);
    if (existing) {
      existing.players.push(player);
    } else {
      const coords = getCoords(player.primaryPosition ?? null);
      grouped.set(key, { players: [player], ...coords });
    }
  }

  const result: PlayerWithCoords[] = [];
  const ROW_Y_OFFSET = 5; // % of container height; creates two staggered rows for large groups

  for (const [posKey, { players: group, xPct, yPct, halfSpan }] of grouped.entries()) {
    if (group.length < 3) {
      const xPositions = spreadHorizontal(group.length, xPct, halfSpan);
      for (let i = 0; i < group.length; i++) {
        const player = group[i];
        const x = xPositions[i];
        if (player !== undefined && x !== undefined) {
          result.push({ player, xPct: Math.max(8, Math.min(92, x)), yPct, positionKey: posKey });
        }
      }
    } else {
      const row1Count = Math.ceil(group.length / 2);
      const row2Count = group.length - row1Count;
      const row1 = group.slice(0, row1Count);
      const row2 = group.slice(row1Count);

      const xPos1 = spreadHorizontal(row1Count, xPct, halfSpan);
      for (let i = 0; i < row1.length; i++) {
        const player = row1[i];
        const x = xPos1[i];
        if (player !== undefined && x !== undefined) {
          result.push({ player, xPct: Math.max(8, Math.min(92, x)), yPct: yPct - ROW_Y_OFFSET, positionKey: posKey });
        }
      }

      const xPos2 = spreadHorizontal(row2Count, xPct, halfSpan);
      for (let i = 0; i < row2.length; i++) {
        const player = row2[i];
        const x = xPos2[i];
        if (player !== undefined && x !== undefined) {
          result.push({ player, xPct: Math.max(8, Math.min(92, x)), yPct: yPct + ROW_Y_OFFSET, positionKey: posKey });
        }
      }
    }
  }

  return result;
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
        <svg
          viewBox="0 0 300 400"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Campo de futebol — jogadores por posição"
          className="absolute inset-0 w-full h-full"
        >
          {/* Fundo verde */}
          <rect width="300" height="400" fill="#2d6a2d" rx="4" />

          {/* Limite exterior */}
          <rect x="15" y="10" width="270" height="380" stroke="white" strokeWidth="2" fill="none" strokeOpacity="0.9" />

          {/* Linha de meio-campo */}
          <line x1="15" y1="200" x2="285" y2="200" stroke="white" strokeWidth="1.5" strokeOpacity="0.9" />

          {/* Círculo central */}
          <circle cx="150" cy="200" r="33" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <circle cx="150" cy="200" r="2" fill="white" fillOpacity="0.9" />

          {/* Área de penálti superior */}
          <rect x="70" y="10" width="160" height="60" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <rect x="114" y="10" width="72" height="20" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <rect x="136" y="1" width="28" height="9" stroke="white" strokeWidth="1.5" fill="rgba(0,0,0,0.25)" strokeOpacity="0.9" />
          <circle cx="150" cy="50" r="2" fill="white" fillOpacity="0.9" />
          <path d="M 124 70 A 33 33 0 0 0 176 70" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />

          {/* Área de penálti inferior */}
          <rect x="70" y="330" width="160" height="60" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <rect x="114" y="370" width="72" height="20" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <rect x="136" y="390" width="28" height="9" stroke="white" strokeWidth="1.5" fill="rgba(0,0,0,0.25)" strokeOpacity="0.9" />
          <circle cx="150" cy="350" r="2" fill="white" fillOpacity="0.9" />
          <path d="M 124 330 A 33 33 0 0 1 176 330" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />

          {/* Arcos de canto */}
          <path d="M 23 10 A 8 8 0 0 1 15 18" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <path d="M 277 10 A 8 8 0 0 0 285 18" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <path d="M 15 382 A 8 8 0 0 0 23 390" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
          <path d="M 285 382 A 8 8 0 0 1 277 390" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
        </svg>

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
