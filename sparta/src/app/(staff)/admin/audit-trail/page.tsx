/**
 * Audit Trail & Reporting Page (Story 8.8)
 *
 * Query and display admin action logs with:
 * - Filtering by action, target_kind, actor_id, date range
 * - Pagination
 * - Export capability
 */

export default function AuditTrailPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Auditoria — Registo de Ações Administrativas</h2>
        <p className="text-sm text-gray-500 mt-1">Histórico de todas as ações realizadas no módulo de administração</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="font-semibold mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ação</label>
            <input
              type="text"
              placeholder="Ex: rosters.created"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tabela</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Todas</option>
              <option value="rosters">rosters</option>
              <option value="teams">teams</option>
              <option value="team_players">team_players</option>
              <option value="team_coaches">team_coaches</option>
              <option value="player_loans">player_loans</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
            <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
            <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
            Filtrar
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm font-medium">
            Limpar
          </button>
          <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium ml-auto">
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Data/Hora</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ação</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Tabela</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ator</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="hover:bg-gray-50">
              <td colSpan={5} className="px-6 py-4 text-sm text-center text-gray-500">
                Carregando...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">Mostrando — registos</div>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm disabled:opacity-50">
            ← Anterior
          </button>
          <span className="px-3 py-2 text-sm">Página — de —</span>
          <button className="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm disabled:opacity-50">
            Próxima →
          </button>
        </div>
      </div>

      {/* Note */}
      <p className="text-sm text-gray-500 mt-6">
        ℹ️ A página completa seria implementada com data fetching, filtros dinâmicos, paginação interativa e export real.
      </p>
    </div>
  );
}
