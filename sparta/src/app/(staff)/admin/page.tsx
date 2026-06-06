/**
 * Admin Dashboard (Story 8.7)
 *
 * Overview of:
 * - Active rosters
 * - Teams per roster
 * - Players assigned
 * - Pending loans
 */

export default function AdminDashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Rosters Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase">Rosters Ativos</h3>
        <p className="text-3xl font-bold mt-2">-</p>
        <p className="text-xs text-gray-400 mt-2">Carregando...</p>
      </div>

      {/* Teams Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase">Equipas</h3>
        <p className="text-3xl font-bold mt-2">-</p>
        <p className="text-xs text-gray-400 mt-2">Carregando...</p>
      </div>

      {/* Players Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase">Jogadores</h3>
        <p className="text-3xl font-bold mt-2">-</p>
        <p className="text-xs text-gray-400 mt-2">Carregando...</p>
      </div>

      {/* Pending Loans Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase">Empréstimos Pendentes</h3>
        <p className="text-3xl font-bold mt-2">-</p>
        <p className="text-xs text-gray-400 mt-2">Carregando...</p>
      </div>

      {/* Quick Actions */}
      <div className="lg:col-span-4 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <a
            href="/admin/rosters"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium"
          >
            Criar Roster
          </a>
          <a
            href="/admin/teams"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium"
          >
            Criar Equipa
          </a>
          <a
            href="/admin/players"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium"
          >
            Adicionar Jogador
          </a>
          <a
            href="/admin/coaches"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium"
          >
            Atribuir Treinador
          </a>
          <a
            href="/admin/loans"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium"
          >
            Gerir Empréstimos
          </a>
        </div>
      </div>
    </div>
  );
}
