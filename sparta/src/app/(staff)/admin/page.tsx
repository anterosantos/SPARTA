import { requireStaffRole } from "@/lib/actions/auth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";

async function getAdminStats(clubId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getServiceRoleClient() as any;

  const [rostersResult, teamsResult, playersResult, loansResult] =
    await Promise.all([
      db.from("rosters").select("id", { count: "exact" }).eq("club_id", clubId).eq("status", "active"),
      db.from("teams").select("id", { count: "exact" }).eq("is_archived", false)
        .in("roster_id", db.from("rosters").select("id").eq("club_id", clubId)),
      db.from("team_players").select("id", { count: "exact" }).eq("status", "active")
        .in("team_id", db.from("teams").select("id")
          .in("roster_id", db.from("rosters").select("id").eq("club_id", clubId))),
      db.from("player_loans").select("id", { count: "exact" }).eq("status", "pending")
        .in("from_team_id", db.from("teams").select("id")
          .in("roster_id", db.from("rosters").select("id").eq("club_id", clubId))),
    ]);

  return {
    rosters: rostersResult.count ?? 0,
    teams: teamsResult.count ?? 0,
    players: playersResult.count ?? 0,
    loans: loansResult.count ?? 0,
  };
}

export default async function AdminDashboard() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const { clubId } = authResult.data;
  const stats = await getAdminStats(clubId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase">Rosters Ativos</h3>
        <p className="text-3xl font-bold mt-2">{stats.rosters}</p>
        <p className="text-xs text-gray-400 mt-2">Época atual</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase">Equipas</h3>
        <p className="text-3xl font-bold mt-2">{stats.teams}</p>
        <p className="text-xs text-gray-400 mt-2">Equipas ativas</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase">Jogadores</h3>
        <p className="text-3xl font-bold mt-2">{stats.players}</p>
        <p className="text-xs text-gray-400 mt-2">Atribuídos a equipas</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase">Empréstimos Pendentes</h3>
        <p className="text-3xl font-bold mt-2">{stats.loans}</p>
        <p className="text-xs text-gray-400 mt-2">Aguardam aprovação</p>
      </div>

      <div className="lg:col-span-4 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <a href="/admin/rosters" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium">
            Criar Roster
          </a>
          <a href="/admin/teams" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium">
            Criar Equipa
          </a>
          <a href="/admin/players" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium">
            Adicionar Jogador
          </a>
          <a href="/admin/coaches" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium">
            Atribuir Treinador
          </a>
          <a href="/admin/loans" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium">
            Gerir Empréstimos
          </a>
        </div>
      </div>
    </div>
  );
}
