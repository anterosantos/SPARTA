/* eslint-disable @typescript-eslint/no-explicit-any */
import { listTeams } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function TeamsPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const teams = await listTeams();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Equipas</h2>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Nome</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Escalão</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Nível</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Roster</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">B-team</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {teams.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                  Nenhuma equipa criada ainda.
                </td>
              </tr>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              teams.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.escalao ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.level ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.rosters?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.is_b_team ? "Sim" : "Não"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
