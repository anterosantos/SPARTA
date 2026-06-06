/**
 * Player Loans Management Page (Story 8.7)
 */

export default function LoansPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Empréstimos de Jogadores</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
          Solicitar Empréstimo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 uppercase font-medium">Pendentes</p>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 uppercase font-medium">Aprovados</p>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 uppercase font-medium">Rejeitados</p>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Jogador</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">De</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Para</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
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
    </div>
  );
}
