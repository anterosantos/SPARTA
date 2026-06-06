/* eslint-disable @typescript-eslint/no-explicit-any */
import { listRosterPlayers, listTeams, listClubPlayers, addPlayerToTeam, removePlayerFromTeam } from "@/lib/actions/admin";
import { requireAdminRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

const POSITIONS = ["GR", "DD", "DC", "DE", "MD", "MC", "ME", "AV"];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const authResult = await requireAdminRole();
  if (!authResult.ok) redirect("/login");

  const params = await searchParams;
  const [rosterPlayers, teams, allPlayers] = await Promise.all([
    listRosterPlayers(),
    listTeams(),
    listClubPlayers(),
  ]);

  async function handleAdd(formData: FormData) {
    "use server";
    const playerId = formData.get("player_id") as string;
    const teamId = formData.get("team_id") as string;
    const position = (formData.get("position") as string) || undefined;
    if (!playerId || !teamId) return redirect("/admin/players?error=Preenche+todos+os+campos");
    const result = await addPlayerToTeam(playerId, teamId, position);
    if (!result.ok) {
      const msg = encodeURIComponent(result.error?.message ?? "Erro ao adicionar jogador");
      return redirect(`/admin/players?error=${msg}`);
    }
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
      {params.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          ⚠️ {decodeURIComponent(params.error)}
        </div>
      )}

      {/* Formulário: atribuir jogador a equipa */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Adicionar Jogador a Equipa</h2>
        <form action={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jogador</label>
            <select name="player_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
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
            <select name="team_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar equipa...</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}{t.escalao ? ` (${t.escalao})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posição (opcional)</label>
            <select name="position" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
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

      {/* Tabela: todos os jogadores no roster */}
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
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Equipa(s)</th>
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
              rosterPlayers.map((rp: any, idx: number) => {
                const player = rp.player;
                const teamAssignments: any[] = rp.teams;
                return (
                  <tr key={`${rp.rosterId}-${player?.id}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {player?.full_name ?? "—"}{player?.jersey_num ? ` #${player.jersey_num}` : ""}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {player?.age_group ? (
                        <span className="text-blue-600 font-medium">{player.age_group}</span>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{rp.rosterName}</td>
                    <td className="px-6 py-4 text-sm">
                      {teamAssignments.length === 0 ? (
                        <span className="text-gray-400 italic">Sem equipa</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {teamAssignments.map((tp: any) => (
                            <span
                              key={tp.team_id}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                tp.status === "active" ? "bg-green-100 text-green-700" :
                                tp.status === "loaned" ? "bg-yellow-100 text-yellow-700" :
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {tp.teams?.name ?? "—"}
                              {tp.status !== "active" && ` (${tp.status === "loaned" ? "emp." : "res."})`}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {teamAssignments
                        .filter((tp: any) => tp.status !== "reserve")
                        .map((tp: any) => (
                          <form key={tp.team_id} action={handleRemove} className="inline mr-2">
                            <input type="hidden" name="id" value={tp.id} />
                            <button type="submit" className="text-red-600 hover:text-red-800 text-xs font-medium">
                              Remover de {tp.teams?.name ?? "equipa"}
                            </button>
                          </form>
                        ))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
