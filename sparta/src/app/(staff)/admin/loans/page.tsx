/* eslint-disable @typescript-eslint/no-explicit-any */
import { listPlayerLoans, listTeams, listClubPlayers, requestPlayerLoan, approvePlayerLoan, rejectPlayerLoan, returnPlayerLoan } from "@/lib/actions/admin";
import { requireAdminRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function LoansPage() {
  const authResult = await requireAdminRole();
  if (!authResult.ok) redirect("/login");

  const [loans, teams, allPlayers] = await Promise.all([
    listPlayerLoans(),
    listTeams(),
    listClubPlayers(),
  ]);

  async function handleRequest(formData: FormData) {
    "use server";
    const playerId = formData.get("player_id") as string;
    const fromTeamId = formData.get("from_team_id") as string;
    const toTeamId = formData.get("to_team_id") as string;
    const note = (formData.get("note") as string) || undefined;
    if (!playerId || !fromTeamId || !toTeamId) return;
    await requestPlayerLoan(playerId, fromTeamId, toTeamId, note);
    redirect("/admin/loans");
  }

  async function handleApprove(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    await approvePlayerLoan(id);
    redirect("/admin/loans");
  }

  async function handleReject(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    await rejectPlayerLoan(id, "Rejeitado pelo treinador");
    redirect("/admin/loans");
  }

  async function handleReturn(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    await returnPlayerLoan(id);
    redirect("/admin/loans");
  }

  return (
    <div className="space-y-6">
      {/* Request form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Solicitar Empréstimo</h2>
        <form action={handleRequest} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jogador</label>
            <select name="player_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar jogador...</option>
              {allPlayers.map((p: any) => (
                <option key={p.id} value={p.id}>{p.full_name}{p.jersey_num ? ` #${p.jersey_num}` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipa de origem</label>
            <select name="from_team_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Equipa de origem...</option>
              {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipa de destino</label>
            <select name="to_team_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Equipa de destino...</option>
              {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
            <input name="note" placeholder="Motivo do empréstimo..." className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
              Solicitar Empréstimo
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Empréstimos ({loans.length})</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Jogador</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Nota</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loans.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">Nenhum empréstimo registado ainda.</td></tr>
            ) : (
              loans.map((l: any) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{l.players?.full_name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      l.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      l.status === "approved" ? "bg-green-100 text-green-700" :
                      l.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {l.status === "pending" ? "Pendente" : l.status === "approved" ? "Aprovado" : l.status === "rejected" ? "Rejeitado" : "Devolvido"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{l.note ?? "—"}</td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    {l.status === "pending" && (<>
                      <form action={handleApprove} className="inline">
                        <input type="hidden" name="id" value={l.id} />
                        <button type="submit" className="text-green-600 hover:text-green-800 font-medium">Aprovar</button>
                      </form>
                      <form action={handleReject} className="inline">
                        <input type="hidden" name="id" value={l.id} />
                        <button type="submit" className="text-red-600 hover:text-red-800 font-medium">Rejeitar</button>
                      </form>
                    </>)}
                    {l.status === "approved" && (
                      <form action={handleReturn} className="inline">
                        <input type="hidden" name="id" value={l.id} />
                        <button type="submit" className="text-blue-600 hover:text-blue-800 font-medium">Devolver</button>
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
