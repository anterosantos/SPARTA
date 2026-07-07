"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPlayerToTeam, removePlayerFromTeam, deletePlayer } from "@/lib/actions/admin";

interface Team {
  id: string;
  name: string;
  escalao?: string | null;
  roster_id: string;
}

interface Assignment {
  id: string;
  team_id: string;
  status: string;
  teams: { id: string; name: string } | null;
}

interface RosterRow {
  rosterId: string;
  rosterName: string;
  player: { id: string; full_name: string; jersey_num: number; age_group: string } | null;
  teams: Assignment[];
}

interface Props {
  rosterPlayers: RosterRow[];
  allTeams: Team[];
}

export function RosterPlayersTable({ rosterPlayers, allTeams }: Props) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Jogadores no Roster ({rosterPlayers.length})</h2>
      </div>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Jogador</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Escalão</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Roster</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Equipas</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rosterPlayers.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                Nenhum jogador no roster ainda.
              </td>
            </tr>
          ) : (
            rosterPlayers.map((rp, idx) => (
              <tr key={`${rp.rosterId}-${rp.player?.id ?? idx}`} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {rp.player?.full_name ?? "—"}
                  {rp.player?.jersey_num ? ` #${rp.player.jersey_num}` : ""}
                </td>
                <td className="px-6 py-4 text-sm">
                  {rp.player?.age_group ? (
                    <span className="text-blue-600 font-medium">{rp.player.age_group}</span>
                  ) : "—"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{rp.rosterName}</td>
                <td className="px-6 py-4">
                  {rp.player && (
                    <TeamSelector
                      playerId={rp.player.id}
                      allTeams={allTeams.filter((t) => t.roster_id === rp.rosterId)}
                      assignments={rp.teams}
                    />
                  )}
                </td>
                <td className="px-6 py-4">
                  {rp.player && (
                    <DeletePlayerButton playerId={rp.player.id} playerName={rp.player.full_name} />
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TeamSelector({
  playerId,
  allTeams,
  assignments,
}: {
  playerId: string;
  allTeams: Team[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const assignedTeamIds = new Set(assignments.map((a) => a.team_id));
  const assignmentByTeamId = new Map(assignments.map((a) => [a.team_id, a]));

  function handleToggle(teamId: string, checked: boolean) {
    startTransition(async () => {
      if (checked) {
        await addPlayerToTeam(playerId, teamId);
      } else {
        const assignment = assignmentByTeamId.get(teamId);
        if (assignment) {
          await removePlayerFromTeam(assignment.id);
        }
      }
      router.refresh();
    });
  }

  if (allTeams.length === 0) {
    return <span className="text-xs text-gray-400">Sem equipas neste roster</span>;
  }

  return (
    <div className={`flex flex-wrap gap-3 ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
      {allTeams.map((team) => {
        const isAssigned = assignedTeamIds.has(team.id);
        return (
          <label
            key={team.id}
            className="flex items-center gap-1.5 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={isAssigned}
              onChange={(e) => handleToggle(team.id, e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={`text-sm ${isAssigned ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              {team.name}
              {team.escalao ? ` (${team.escalao})` : ""}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function DeletePlayerButton({ playerId, playerName }: { playerId: string; playerName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const confirmed = window.confirm(
      `Apagar "${playerName}" permanentemente?\n\nEsta ação é irreversível e apaga TODOS os dados associados (fadiga, eventos, presenças, métricas, consentimentos, equipas, empréstimos, etc.).`
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deletePlayer(playerId);
      if (!result.ok) {
        setError(result.error?.message ?? "Erro ao apagar jogador");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
      >
        Apagar
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
