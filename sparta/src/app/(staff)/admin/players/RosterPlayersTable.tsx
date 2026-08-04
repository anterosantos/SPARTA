"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPlayerToTeam, removePlayerFromTeam, deletePlayer, deletePlayers, movePlayerToRoster } from "@/lib/actions/admin";
import { withdrawConsentByStaff } from "@/lib/actions/data-rights";

interface Team {
  id: string;
  name: string;
  escalao?: string | null;
  roster_id: string;
}

interface Roster {
  id: string;
  name: string;
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
  player: { id: string; full_name: string; jersey_num: number | null; age_group: string } | null;
  teams: Assignment[];
}

interface Props {
  rosterPlayers: RosterRow[];
  allTeams: Team[];
  allRosters: Roster[];
}

export function RosterPlayersTable({ rosterPlayers, allTeams, allRosters }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);

  const selectablePlayers = rosterPlayers.filter((rp) => rp.player);
  const allSelected =
    selectablePlayers.length > 0 && selectablePlayers.every((rp) => selectedIds.has(rp.player!.id));

  function toggleOne(playerId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(playerId);
      else next.delete(playerId);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(selectablePlayers.map((rp) => rp.player!.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleBulkDelete() {
    const count = selectedIds.size;
    const confirmed = window.confirm(
      `Apagar ${count} jogador${count === 1 ? "" : "es"} permanentemente?\n\nEsta ação é irreversível e apaga TODOS os dados associados a cada jogador (fadiga, eventos, presenças, métricas, consentimentos, equipas, empréstimos, etc.).`
    );
    if (!confirmed) return;

    setBulkError(null);
    startTransition(async () => {
      const result = await deletePlayers([...selectedIds]);
      if (!result.ok) {
        setBulkError(result.error?.message ?? "Erro ao apagar jogadores");
        return;
      }
      if (result.data && result.data.failed.length > 0) {
        setBulkError(
          `${result.data.deletedCount} apagado(s); ${result.data.failed.length} falharam.`
        );
      }
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Jogadores no Roster ({rosterPlayers.length})</h2>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{selectedIds.size} selecionado(s)</span>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isPending}
              className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Apagar Selecionados
            </button>
          </div>
        )}
      </div>
      {bulkError && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">{bulkError}</div>
      )}
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={selectablePlayers.length === 0}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label="Selecionar todos os jogadores"
              />
            </th>
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
              <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                Nenhum jogador no roster ainda.
              </td>
            </tr>
          ) : (
            rosterPlayers.map((rp, idx) => (
              <tr key={`${rp.rosterId}-${rp.player?.id ?? idx}`} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  {rp.player && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(rp.player.id)}
                      onChange={(e) => toggleOne(rp.player!.id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Selecionar ${rp.player.full_name}`}
                    />
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {rp.player?.full_name ?? "—"}
                  {rp.player?.jersey_num ? ` #${rp.player.jersey_num}` : ""}
                </td>
                <td className="px-6 py-4 text-sm">
                  {rp.player?.age_group ? (
                    <span className="text-blue-600 font-medium">{rp.player.age_group}</span>
                  ) : "—"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {rp.player ? (
                    <RosterSelector
                      playerId={rp.player.id}
                      currentRosterId={rp.rosterId}
                      currentRosterName={rp.rosterName}
                      allRosters={allRosters}
                    />
                  ) : (
                    rp.rosterName
                  )}
                </td>
                <td className="px-6 py-4">
                  {rp.player && (
                    <TeamSelector
                      playerId={rp.player.id}
                      allTeams={allTeams.filter((t) => t.roster_id === rp.rosterId)}
                      assignments={rp.teams}
                    />
                  )}
                </td>
                <td className="px-6 py-4 space-y-1">
                  {rp.player && (
                    <>
                      <DeletePlayerButton playerId={rp.player.id} playerName={rp.player.full_name} />
                      <WithdrawConsentButton playerId={rp.player.id} playerName={rp.player.full_name} />
                    </>
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

function RosterSelector({
  playerId,
  currentRosterId,
  currentRosterName,
  allRosters,
}: {
  playerId: string;
  currentRosterId: string;
  currentRosterName: string;
  allRosters: Roster[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Ensure the player's current roster is always selectable, even if it's
  // no longer active — marked distinctly so it isn't mistaken for a real option.
  const options = allRosters.some((r) => r.id === currentRosterId)
    ? allRosters
    : [{ id: currentRosterId, name: `${currentRosterName} (inativo)` }, ...allRosters];

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRosterId = e.target.value;
    if (!newRosterId || newRosterId === currentRosterId) return;

    const confirmed = window.confirm(
      "Mudar jogador para outro roster?\n\nAs equipas atualmente atribuídas ficam ligadas ao roster antigo e podem deixar de fazer sentido — revê as equipas depois de mudar."
    );
    if (!confirmed) {
      e.target.value = currentRosterId;
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await movePlayerToRoster(playerId, currentRosterId, newRosterId);
      if (!result.ok) {
        setError(result.error?.message ?? "Erro ao mudar de roster");
        e.target.value = currentRosterId;
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <select
        key={currentRosterId}
        defaultValue={currentRosterId}
        onChange={handleChange}
        disabled={isPending}
        aria-label={`Roster de ${currentRosterName}`}
        className="px-2 py-1 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {options.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
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

/**
 * Staff-mediated consent withdrawal for requests received outside the
 * self-service channels (phone, email). Requires typing the player's full
 * name to confirm — stricter than DeletePlayerButton's window.confirm(),
 * by explicit product decision, since this is triggered on someone else's
 * behalf rather than by the titular themselves.
 */
function WithdrawConsentButton({ playerId, playerName }: { playerId: string; playerName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [nameConfirm, setNameConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reasonOk = reason.trim().length >= 3;
  const nameMatches = playerName.trim().length > 0 && nameConfirm.trim() === playerName.trim();
  const canConfirm = nameMatches && reasonOk && !isPending;

  function handleConfirm() {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      const result = await withdrawConsentByStaff(playerId, reason.trim());
      if (!result.ok) {
        setError(result.error?.message ?? "Erro ao retirar consentimento");
        return;
      }
      router.refresh();
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-orange-600 hover:text-orange-800 text-sm font-medium"
      >
        Retirar consentimento
      </button>
    );
  }

  return (
    <div className="border border-orange-300 rounded-md p-3 bg-orange-50 space-y-2 max-w-xs">
      <p className="text-xs text-orange-800">
        Isto apaga permanentemente TODOS os dados de &quot;{playerName}&quot; (RGPD Art. 21) —
        igual a &quot;Apagar&quot;, mas registado como retirada de consentimento. Irreversível.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (ex: pedido por telefone em 04/08, confirmado pelo encarregado)"
        maxLength={500}
        rows={2}
        disabled={isPending}
        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
      />
      <input
        type="text"
        value={nameConfirm}
        onChange={(e) => setNameConfirm(e.target.value)}
        placeholder={`Escreve "${playerName}" para confirmar`}
        disabled={isPending}
        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
      />
      {!canConfirm && !isPending && (reason.length > 0 || nameConfirm.length > 0) && (
        <p className="text-xs text-orange-700">
          {!reasonOk ? "Motivo precisa de pelo menos 3 caracteres. " : ""}
          {!nameMatches ? "O nome tem de corresponder exatamente." : ""}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="px-3 py-1 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirmar retirada
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setReason("");
            setNameConfirm("");
            setError(null);
          }}
          disabled={isPending}
          className="px-3 py-1 text-gray-600 text-sm hover:text-gray-800"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
