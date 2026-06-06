/* eslint-disable @typescript-eslint/no-explicit-any */
import { listRosters, listSeasons, createRoster, archiveRoster } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function RostersPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const { clubId } = authResult.data;
  const [rosters, seasons] = await Promise.all([listRosters(), listSeasons()]);

  async function handleCreate(formData: FormData) {
    "use server";
    const seasonId = formData.get("season_id") as string;
    const name = formData.get("name") as string;
    if (!seasonId || !name) return;
    await createRoster(clubId, seasonId, name);
    redirect("/admin/rosters");
  }

  async function handleArchive(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    await archiveRoster(id);
    redirect("/admin/rosters");
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Criar Roster</h2>
        <form action={handleCreate} className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              name="name"
              required
              placeholder="Ex: Plantel 2025/2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Época</label>
            <select
              name="season_id"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar época...</option>
              {seasons.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.is_current ? " (atual)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Criar Roster
          </button>
        </form>
        {seasons.length === 0 && (
          <p className="text-sm text-amber-600 mt-3">⚠️ Não há épocas disponíveis. Crie uma época no Supabase primeiro.</p>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Rosters ({rosters.length})</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Nome</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Época</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rosters.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                  Nenhum roster criado ainda.
                </td>
              </tr>
            ) : (
              rosters.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{r.seasons?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      r.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {r.status === "active" ? "Ativo" : "Arquivado"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {r.status === "active" && (
                      <form action={handleArchive} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                          onClick={(e) => { if (!confirm("Arquivar este roster e todas as equipas?")) e.preventDefault(); }}
                        >
                          Arquivar
                        </button>
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
