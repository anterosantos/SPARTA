"use client";

import { useEffect, useState } from "react";
import { PlayerButton } from "./player-button";
import { useMatchSession } from "@/lib/stores/match-session";
import { getLineupForSession } from "@/lib/actions/lineups";
import type { MatchLineupRow } from "@/lib/stores/match-session";

interface PlayerGridProps {
  sessionId: string;
  refreshTrigger?: number;
}

export function PlayerGrid({ sessionId, refreshTrigger = 0 }: PlayerGridProps) {
  const [players, setPlayers] = useState<MatchLineupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSelectedPlayer = useMatchSession((s) => s.setSelectedPlayer);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPlayers() {
      try {
        setLoading(true);
        const result = await getLineupForSession(sessionId);
        if (controller.signal.aborted) return;
        if (!result.ok) {
          setError("Erro ao carregar convocatória.");
          return;
        }
        const transformedPlayers: MatchLineupRow[] = result.data
          .filter((lineup) => lineup.role === "starter")
          .map((lineup) => ({
            id: lineup.id,
            session_id: lineup.session_id,
            player_id: lineup.player_id,
            name: lineup.name,
            jersey_number: lineup.jersey_number,
            position: lineup.position,
            age_group: lineup.age_group,
            processing_restricted: lineup.processing_restricted,
            role: lineup.role,
          }));
        setPlayers(transformedPlayers);
      } catch {
        if (!controller.signal.aborted) {
          setError("Erro ao carregar convocatória.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPlayers();
    return () => controller.abort();
  }, [sessionId, refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-slate-500">Carregando jogadores...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-red-600 dark:text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3">
      <div id="restricted-tooltip-match-capture" className="sr-only">
        Tratamento limitado — este jogador não pode ser analisado
      </div>
      <div className="flex-1 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 [grid-auto-rows:1fr]">
        {players.map((player) => (
          <PlayerButton
            key={player.id}
            player={player}
            onClick={() => setSelectedPlayer(player)}
          />
        ))}
      </div>
    </div>
  );
}
