/**
 * Teams Management Page (Story 8.7)
 */

export default function TeamsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Equipas</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
          Criar Equipa
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Nome</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Escalão</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Jogadores</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="hover:bg-gray-50">
              <td colSpan={4} className="px-6 py-4 text-sm text-center text-gray-500">
                Carregando...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
