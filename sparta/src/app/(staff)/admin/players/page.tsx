/**
 * Players Management Page (Story 8.7)
 */

export default function PlayersPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Jogadores</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
          Adicionar Jogador
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 text-center text-gray-500">Carregando...</div>
      </div>
    </div>
  );
}
