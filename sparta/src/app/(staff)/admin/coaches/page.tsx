/* eslint-disable @typescript-eslint/no-explicit-any */
import { listTeamCoaches, listTeams, listClubProfiles, assignCoachToTeam, removeCoachFromTeam } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function CoachesPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const [coaches, teams, profiles] = await Promise.all([
    listTeamCoaches(),
    listTeams(),
    listClubProfiles(),
  ]);

  async function handleAssign(formData: FormData) {
    "use server";
    const profileId = formData.get("profile_id") as string;
    const teamId = formData.get("team_id") as string;
    const role = (formData.get("role") as "principal" | "assistant" | "analyst") || "assistant";
    if (!profileId || !teamId) return;
    await assignCoachToTeam(profileId, teamId, role);
    redirect("/admin/coaches");
  }

  async function handleRemove(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    await removeCoachFromTeam(id);
    redirect("/admin/coaches");
  }

  return (
    <div className="space-y-6">
      {/* Assign form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Atribuir Treinador a Equipa</h2>
        <form action={handleAssign} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Treinador / Analista</label>
            <select name="profile_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar pessoa...</option>
              {profiles.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.id} ({p.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipa</label>
            <select name="team_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar equipa...</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
            <select name="role" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="assistant">Assistente</option>
              <option value="principal">Principal</option>
              <option value="analyst">Analista</option>
            </select>
          </div>
          <div>
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
              Atribuir
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
          <h2 className="text-lg font-semibold">Treinadores em Equipas ({coaches.length})</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Nome</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Equipa</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Papel</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {coaches.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">Nenhum treinador atribuído ainda.</td></tr>
            ) : (
              coaches.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.profiles?.full_name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.teams?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.role === "principal" ? "bg-blue-100 text-blue-700" :
                      c.role === "analyst" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {c.role === "principal" ? "Principal" : c.role === "analyst" ? "Analista" : "Assistente"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <form action={handleRemove} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="text-red-600 hover:text-red-800 text-sm font-medium">Remover</button>
                    </form>
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
