/* eslint-disable @typescript-eslint/no-explicit-any */
import { listTeams, listRosters, createTeam, archiveTeam } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

const ESCALOES = ["u13", "u14", "u15", "u16", "u17", "u19", "senior"];

export default async function TeamsPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const [teams, rosters] = await Promise.all([listTeams(), listRosters()]);
  const activeRosters = rosters.filter((r: any) => r.status === "active");

  async function handleCreate(formData: FormData) {
    "use server";
    const rosterId = formData.get("roster_id") as string;
    const name = formData.get("name") as string;
    const escalao = (formData.get("escalao") as string) || null;
    const level = (formData.get("level") as string) || null;
    const isBTeam = formData.get("is_b_team") === "on";
    if (!rosterId || !name) return;
    await createTeam(rosterId, name, escalao, level, isBTeam);
    redirect("/admin/teams");
  }

  async function handleArchive(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    await archiveTeam(id);
    redirect("/admin/teams");
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Criar Equipa</h2>
        <form action={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input name="name" required placeholder="Ex: Seniores A" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Escalão</label>
            <select name="escalao" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sem escalão</option>
              {ESCALOES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nível (A/B/C)</label>
            <input name="level" placeholder="Ex: A" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" name="is_b_team" id="is_b_team" className="rounded" />
            <label htmlFor="is_b_team" className="text-sm text-gray-700">Equipa B (senior)</label>
          </div>
          <div className="pt-5">
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
              Criar Equipa
            </button>
          </div>
        </form>
        {activeRosters.length === 0 && (
          <p className="text-sm text-amber-600 mt-3">⚠️ Não há rosters ativos. Crie um roster primeiro.</p>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Equipas ({teams.length})</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Nome</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Escalão</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Nível</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Roster</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">B-team</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {teams.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">Nenhuma equipa criada ainda.</td></tr>
            ) : (
              teams.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.escalao ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.level ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.rosters?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.is_b_team ? "✓" : "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <form action={handleArchive} className="inline">
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="text-red-600 hover:text-red-800 text-sm font-medium">Arquivar</button>
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
