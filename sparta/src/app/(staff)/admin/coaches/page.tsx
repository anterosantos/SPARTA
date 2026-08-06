/* eslint-disable @typescript-eslint/no-explicit-any */
import { listTeamCoaches, listTeams, listClubProfiles, listRosters, assignCoachToTeam, removeCoachFromTeam, inviteCoach, resendCoachInvite } from "@/lib/actions/admin";
import { requireAdminRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { AssignCoachForm } from "./AssignCoachForm";
import { CopyCoachInviteLinkButton } from "./CopyCoachInviteLinkButton";

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string; resent?: string }>;
}) {
  const authResult = await requireAdminRole();
  if (!authResult.ok) redirect("/login");

  const params = await searchParams;
  const [coaches = [], teams = [], profiles = [], rosters = []] = await Promise.all([
    listTeamCoaches(),
    listTeams(),
    listClubProfiles(),
    listRosters(),
  ]);
  const activeRosters = rosters.filter((r: any) => r.status === "active");

  async function handleInvite(formData: FormData) {
    "use server";
    const fullName = formData.get("full_name") as string;
    const email = formData.get("email") as string;
    const role = (formData.get("invite_role") as "coach" | "analyst") || "coach";
    if (!fullName || !email) return redirect("/admin/coaches?error=Preenche+todos+os+campos");
    const result = await inviteCoach(fullName, email, role);
    if (!result.ok) {
      const msg = encodeURIComponent(result.error?.message ?? "Erro ao convidar treinador");
      return redirect(`/admin/coaches?error=${msg}`);
    }
    redirect("/admin/coaches?invited=1");
  }

  async function handleAssign(formData: FormData) {
    "use server";
    const profileId = formData.get("profile_id") as string;
    const teamId = formData.get("team_id") as string;
    const role = (formData.get("role") as "principal" | "assistant" | "analyst") || "assistant";
    if (!profileId || !teamId) return redirect("/admin/coaches?error=Preenche+todos+os+campos");
    const result = await assignCoachToTeam(profileId, teamId, role);
    if (!result.ok) {
      const msg = encodeURIComponent(result.error?.message ?? "Erro ao atribuir treinador");
      return redirect(`/admin/coaches?error=${msg}`);
    }
    redirect("/admin/coaches");
  }

  async function handleRemove(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    await removeCoachFromTeam(id);
    redirect("/admin/coaches");
  }

  async function handleResend(formData: FormData) {
    "use server";
    const profileId = formData.get("profile_id") as string;
    if (!profileId) return;
    const result = await resendCoachInvite(profileId);
    if (!result.ok) {
      const msg = encodeURIComponent(result.error?.message ?? "Erro ao reenviar convite");
      return redirect(`/admin/coaches?error=${msg}`);
    }
    redirect("/admin/coaches?resent=1");
  }

  return (
    <div className="space-y-6">
      {params.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          ⚠️ {decodeURIComponent(params.error)}
        </div>
      )}
      {params.invited && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
          ✓ Convite enviado. A pessoa aparecerá na lista para atribuição assim que aceitar o convite.
        </div>
      )}
      {params.resent && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
          ✓ Convite reenviado.
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Criar Treinador / Analista</h2>
        <form action={handleInvite} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              name="full_name"
              required
              placeholder="Ex: Maria Silva"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              placeholder="maria@exemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
            <select name="invite_role" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="coach">Treinador</option>
              <option value="analyst">Analista</option>
            </select>
          </div>
          <div>
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
              Convidar
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-500 mt-3">
          A pessoa recebe um email para definir a password. Só depois de aceitar o convite fica disponível para ser atribuída a equipas.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Atribuir Treinador a Equipa</h2>
        <AssignCoachForm rosters={activeRosters} teams={teams as any} profiles={profiles as any} action={handleAssign} />
        {activeRosters.length === 0 && (
          <p className="text-sm text-amber-600 mt-3">⚠️ Não há rosters ativos. Crie um roster primeiro.</p>
        )}
      </div>

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
                    <div className="flex items-center gap-3">
                      <form action={handleResend} className="inline">
                        <input type="hidden" name="profile_id" value={c.profile_id} />
                        <button type="submit" className="text-blue-600 hover:text-blue-800 text-sm font-medium">Reenviar</button>
                      </form>
                      <CopyCoachInviteLinkButton profileId={c.profile_id} />
                      <form action={handleRemove} className="inline">
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="text-red-600 hover:text-red-800 text-sm font-medium">Remover</button>
                      </form>
                    </div>
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
