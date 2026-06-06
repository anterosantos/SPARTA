"use client";

import { useState } from "react";
import { FieldFormation, STATE_COLORS, STATE_LABELS } from "@/components/domain/readiness/field-formation";
import { PlayerDrillDownSheet } from "@/components/domain/readiness/player-drill-down-sheet";
import { SemaforoBadge } from "@/components/ui/semaforo-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlayerReadinessData } from "@/types/supabase";

const POSITION_LABELS: Record<string, string> = {
  GR:  'Guarda-Redes',
  DC:  'Defesa Central',
  DD:  'Defesa Direito',
  DE:  'Defesa Esquerdo',
  LIB: 'Líbero',
  MDC: 'Médio Defensivo',
  MC:  'Médio Centro',
  MO:  'Médio Ofensivo',
  MD:  'Médio Direito',
  ME:  'Médio Esquerdo',
  EXD: 'Extremo Direito',
  EXE: 'Extremo Esquerdo',
  SC:  'Segundo Avançado',
  PL:  'Ponta de Lança',
  DEF: 'Defesa',
  MED: 'Médio',
  AVA: 'Avançado',
};

type SemaforoState = "ready" | "caution" | "alert" | "neutral";

function isSemaforoState(s: unknown): s is SemaforoState {
  return s === "ready" || s === "caution" || s === "alert" || s === "neutral";
}

interface SelectedPosition {
  key: string;
  players: PlayerReadinessData[];
}

export interface ReadinessPanelFormationProps {
  players: PlayerReadinessData[];
  flashedIds?: Set<string>;
}

export function ReadinessPanelFormation({ players, flashedIds }: ReadinessPanelFormationProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerReadinessData | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<SelectedPosition | null>(null);

  return (
    <div data-testid="readiness-panel-formation" className="flex flex-col pb-6">
      <div className="px-4 pt-4">
        <FieldFormation
          players={players}
          onSelectPlayer={() => {}}
          onSelectPosition={(key, posPlayers) => setSelectedPosition({ key, players: posPlayers })}
          flashedIds={flashedIds}
        />
      </div>

      <Dialog
        open={selectedPosition !== null}
        onOpenChange={(open) => { if (!open) setSelectedPosition(null); }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>
              {selectedPosition
                ? (POSITION_LABELS[selectedPosition.key] ?? selectedPosition.key)
                : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col px-2 pb-4">
            {selectedPosition?.players.map((player) => {
              const color = STATE_COLORS[player.state ?? 'neutral'] ?? STATE_COLORS['neutral'] ?? '#6b7280';
              const stateLabel = STATE_LABELS[player.state ?? 'neutral'] ?? 'Sem dados';
              const semaforoState = isSemaforoState(player.state) ? player.state : 'neutral';

              return (
                <button
                  key={player.player_id}
                  type="button"
                  className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted w-full text-left"
                  onClick={() => {
                    setSelectedPosition(null);
                    setSelectedPlayer(player);
                  }}
                  aria-label={`Ver detalhe de ${player.playerName ?? 'jogador'}`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  >
                    {player.jerseyNum ?? '?'}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium text-sm">{player.playerName ?? 'Jogador'}</span>
                    <span className="text-xs text-muted-foreground">{stateLabel}</span>
                  </div>
                  <SemaforoBadge state={semaforoState} size="sm" />
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <PlayerDrillDownSheet
        snapshot={selectedPlayer}
        open={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
