/* eslint-disable @typescript-eslint/no-explicit-any */
import { listPlayerLoans } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function LoansPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const loans = await listPlayerLoans();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Empréstimos</h2>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Jogador</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loans.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400">
                  Nenhum empréstimo registado ainda.
                </td>
              </tr>
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
                      {l.status === "pending" ? "Pendente" :
                       l.status === "approved" ? "Aprovado" :
                       l.status === "rejected" ? "Rejeitado" : "Devolvido"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{l.note ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
