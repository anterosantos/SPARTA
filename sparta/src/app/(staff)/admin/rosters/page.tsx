/**
 * Rosters Management Page (Story 8.7)
 *
 * List, create, edit, archive rosters
 */

export default function RostersPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Rosters</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
          Criar Roster
        </button>
      </div>

      {/* Table placeholder */}
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
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm text-gray-600">Carregando...</td>
              <td className="px-6 py-4 text-sm text-gray-600">—</td>
              <td className="px-6 py-4 text-sm text-gray-600">—</td>
              <td className="px-6 py-4 text-sm">
                <button className="text-blue-600 hover:text-blue-800 mr-4">Editar</button>
                <button className="text-red-600 hover:text-red-800">Arquivar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Note */}
      <p className="text-sm text-gray-500 mt-4">
        ℹ️ A UI completa seria implementada com forms React, validação client-side, otimistic updates, e toast feedback.
      </p>
    </div>
  );
}
