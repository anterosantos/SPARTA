/* eslint-disable @typescript-eslint/no-explicit-any */
import { listRosterPlayers, listTeams, listClubPlayers, listRosters, addPlayerToTeam, createPlayerForRoster } from "@/lib/actions/admin";
import { requireAdminRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { RosterPlayersTable } from "./RosterPlayersTable";

const POSITIONS = ["GR", "DD", "DC", "DE", "MD", "MC", "ME", "AV"];
const AGE_GROUPS = ["u14", "u15", "u17", "u19", "senior"];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const authResult = await requireAdminRole();
  if (!authResult.ok) redirect("/login");

  const params = await searchParams;
  const [rosterPlayers, teams, allPlayers, rosters = []] = await Promise.all([
    listRosterPlayers(),
    listTeams(),
    listClubPlayers(),
    listRosters(),
  ]);
  const activeRosters = rosters.filter((r: any) => r.status === "active");

  async function handleCreatePlayer(formData: FormData) {
    "use server";
    const rosterId = formData.get("roster_id") as string;
    const fullName = formData.get("full_name") as string;
    const birthdate = formData.get("birthdate") as string;
    const jerseyNumRaw = formData.get("jersey_num") as string;
    const jerseyNum = jerseyNumRaw ? Number(jerseyNumRaw) : null;
    const ageGroup = formData.get("age_group") as string;
    const position = formData.get("position") as string;
    if (!rosterId || !fullName || !birthdate || !ageGroup || !position) {
      return redirect("/admin/players?error=Preenche+todos+os+campos");
    }
    const result = await createPlayerForRoster(rosterId, fullName, birthdate, jerseyNum, ageGroup, position);
    if (!result.ok) {
      const msg = encodeURIComponent(result.error?.message ?? "Erro ao criar jogador");
      return redirect(`/admin/players?error=${msg}`);
    }
    redirect("/admin/players?created=1");
  }

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

  return (
    <div className="space-y-6">
      {params.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          ⚠️ {decodeURIComponent(params.error)}
        </div>
      )}
      {params.created && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
          ✓ Jogador criado e associado ao roster.
        </div>
      )}

      {/* Formulário: criar jogador e associar diretamente a um roster */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Criar Jogador</h2>
        <form action={handleCreatePlayer} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input name="full_name" required placeholder="Ex: João Silva" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
            <input type="date" name="birthdate" lang="pt-PT" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nº Camisola (opcional)</label>
            <input type="number" name="jersey_num" min={1} max={99} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Escalão</label>
            <select name="age_group" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar escalão...</option>
              {AGE_GROUPS.map((ag) => <option key={ag} value={ag}>{ag}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posição</label>
            <select name="position" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar posição...</option>
              {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Roster</label>
            <select name="roster_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar roster...</option>
              {activeRosters.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
              Criar Jogador
            </button>
          </div>
        </form>
        {activeRosters.length === 0 && (
          <p className="text-sm text-amber-600 mt-3">⚠️ Não há rosters ativos. Crie um roster primeiro.</p>
        )}
      </div>

      {/* Formulário: atribuir jogador a equipa (via form tradicional, para jogadores fora do roster) */}
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

      {/* Tabela com checkboxes de equipa por jogador */}
      <RosterPlayersTable rosterPlayers={rosterPlayers as any} allTeams={teams as any} />
    </div>
  );
}
