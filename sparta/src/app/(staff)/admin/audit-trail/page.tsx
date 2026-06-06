import { getAuditLogsForAdmin } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function AuditTrailPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const result = await getAuditLogsForAdmin({ per_page: 50 });
  const logs = result.ok ? result.data?.logs ?? [] : [];
  const total = result.ok ? result.data?.total ?? 0 : 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Auditoria — Registo de Ações Administrativas</h2>
        <p className="text-sm text-gray-500 mt-1">
          {total} {total === 1 ? "registo" : "registos"} no total
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Data/Hora</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ação</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Tabela</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400">
                  Nenhuma ação administrativa registada ainda.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(log.occurred_at).toLocaleString("pt-PT")}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">{log.action}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{log.target_kind}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
