/* eslint-disable @typescript-eslint/no-explicit-any */
import { listTeamCoaches } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function CoachesPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const coaches = await listTeamCoaches();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Treinadores em Equipas</h2>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Treinador</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Equipa</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Papel</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {coaches.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400">
                  Nenhum treinador atribuído a equipas ainda.
                </td>
              </tr>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
