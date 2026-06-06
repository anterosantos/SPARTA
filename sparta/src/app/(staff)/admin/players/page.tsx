/* eslint-disable @typescript-eslint/no-explicit-any */
import { listTeamPlayers } from "@/lib/actions/admin";
import { requireStaffRole } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function PlayersPage() {
  const authResult = await requireStaffRole();
  if (!authResult.ok) redirect("/login");

  const players = await listTeamPlayers();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Jogadores em Equipas</h2>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Jogador</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Equipa</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Posição</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {players.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                  Nenhum jogador atribuído a equipas ainda.
                </td>
              </tr>
            ) : (
              players.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {p.players?.full_name ?? "—"}
                    {p.players?.jersey_num ? ` #${p.players.jersey_num}` : ""}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.teams?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.position ?? "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      p.status === "active" ? "bg-green-100 text-green-700" :
                      p.status === "loaned" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {p.status === "active" ? "Ativo" : p.status === "loaned" ? "Emprestado" : "Reserva"}
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
