/* eslint-disable @typescript-eslint/no-explicit-any */
import { listTeamPlayers, listTeams, listClubPlayers, addPlayerToTeam, removePlayerFromTeam } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

const POSITIONS = ["GR", "DD", "DC", "DE", "MD", "MC", "ME", "AV"];

export default async function PlayersPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const [teamPlayers, teams, allPlayers] = await Promise.all([
    listTeamPlayers(),
    listTeams(),
    listClubPlayers(),
  ]);

  async function handleAdd(formData: FormData) {
    "use server";
    const playerId = formData.get("player_id") as string;
    const teamId = formData.get("team_id") as string;
    const position = (formData.get("position") as string) || undefined;
    if (!playerId || !teamId) return;
    await addPlayerToTeam(playerId, teamId, position);
    redirect("/admin/players");
  }

  async function handleRemove(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    await removePlayerFromTeam(id);
    redirect("/admin/players");
  }

  return (
    <div className="space-y-6">
      {/* Add player form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Adicionar Jogador a Equipa</h2>
        <form action={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jogador</label>
            <select name="player_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar jogador...</option>
              {allPlayers.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}{p.jersey_num ? ` #${p.jersey_num}` : ""}{p.age_group ? ` (${p.age_group})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipa</label>
            <select name="team_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar equipa...</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}{t.escalao ? ` (${t.escalao})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posição (opcional)</label>
            <select name="position" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sem posição</option>
              {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
            </select>
          </div>
          <div>
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
              Adicionar
            </button>
          </div>
        </form>
        {teams.length === 0 && (
          <p className="text-sm text-amber-600 mt-3">⚠️ Não há equipas disponíveis. Crie uma equipa primeiro.</p>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Jogadores em Equipas ({teamPlayers.length})</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Jogador</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Escalão</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Equipa</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Posição</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {teamPlayers.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">Nenhum jogador atribuído ainda.</td></tr>
            ) : (
              teamPlayers.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {p.players?.full_name ?? "—"}{p.players?.jersey_num ? ` #${p.players.jersey_num}` : ""}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.players?.age_group ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.teams?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.position ?? "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      p.status === "active" ? "bg-green-100 text-green-700" :
                      p.status === "loaned" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {p.status === "active" ? "Ativo" : p.status === "loaned" ? "Emprestado" : "Reserva"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {p.status !== "reserve" && (
                      <form action={handleRemove} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="text-red-600 hover:text-red-800 text-sm font-medium">Remover</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
