/* eslint-disable @typescript-eslint/no-explicit-any */
import { listRosters } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function RostersPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const rosters = await listRosters();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Rosters</h2>
        <span className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">
          Criar Roster
        </span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {r.status === "active" ? "Ativo" : "Arquivado"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
