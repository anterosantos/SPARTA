import { requireStaffRole } from "@/lib/actions/auth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";

async function getAdminStats(clubId: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getServiceRoleClient() as any;

    const { data: rosters, error: rostersError } = await db
      .from("rosters")
      .select("id")
      .eq("club_id", clubId)
      .eq("status", "active");

    if (rostersError || !Array.isArray(rosters)) {
      return { rosters: 0, teams: 0, players: 0, loans: 0 };
    }

    const rosterIds: string[] = rosters.map((r: { id: string }) => r.id);
    if (rosterIds.length === 0) {
      return { rosters: 0, teams: 0, players: 0, loans: 0 };
    }

    const { data: teams, error: teamsError } = await db
      .from("teams")
      .select("id")
      .in("roster_id", rosterIds)
      .eq("is_archived", false);

    if (teamsError || !Array.isArray(teams)) {
      return { rosters: rosterIds.length, teams: 0, players: 0, loans: 0 };
    }

    const teamIds: string[] = teams.map((t: { id: string }) => t.id);
    if (teamIds.length === 0) {
      return { rosters: rosterIds.length, teams: 0, players: 0, loans: 0 };
    }

    const [playersResult, loansResult] = await Promise.all([
      db
        .from("team_players")
        .select("id", { count: "exact", head: true })
        .in("team_id", teamIds)
        .eq("status", "active"),
      db
        .from("player_loans")
        .select("id", { count: "exact", head: true })
        .in("from_team_id", teamIds)
        .eq("status", "pending"),
    ]);

    return {
      rosters: rosterIds.length,
      teams: teamIds.length,
      players: playersResult.count ?? 0,
      loans: loansResult.count ?? 0,
    };
  } catch {
    // Admin tables not yet migrated — return zeros instead of crashing
    return { rosters: 0, teams: 0, players: 0, loans: 0 };
  }
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
