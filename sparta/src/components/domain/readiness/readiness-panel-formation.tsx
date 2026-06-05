"use client";

import { useState } from "react";
import { FieldFormation } from "@/components/domain/readiness/field-formation";
import { PlayerDrillDownSheet } from "@/components/domain/readiness/player-drill-down-sheet";
import type { PlayerReadinessData } from "@/types/supabase";

export interface ReadinessPanelFormationProps {
  players: PlayerReadinessData[];
  flashedIds?: Set<string>;
}

export function ReadinessPanelFormation({ players, flashedIds }: ReadinessPanelFormationProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerReadinessData | null>(null);

  return (
    <div data-testid="readiness-panel-formation" className="flex flex-col pb-6">
      <div className="px-4 pt-4">
        <FieldFormation
          players={players}
          onSelectPlayer={setSelectedPlayer}
          flashedIds={flashedIds}
        />
      </div>

      <PlayerDrillDownSheet
        snapshot={selectedPlayer}
        open={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
