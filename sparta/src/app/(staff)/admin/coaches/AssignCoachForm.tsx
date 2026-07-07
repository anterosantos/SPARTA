"use client";

import { useState } from "react";

interface Roster {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  escalao?: string | null;
  roster_id: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
}

interface Props {
  rosters: Roster[];
  teams: Team[];
  profiles: Profile[];
  action: (formData: FormData) => void;
}

export function AssignCoachForm({ rosters, teams, profiles, action }: Props) {
  const [rosterId, setRosterId] = useState("");

  const teamsInRoster = teams.filter((t) => t.roster_id === rosterId);

  return (
    <>
      <form action={action} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Roster</label>
          <select
            value={rosterId}
            onChange={(e) => setRosterId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecionar roster...</option>
            {rosters.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Treinador / Analista</label>
          <select name="profile_id" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Selecionar pessoa...</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.id} ({p.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Equipa</label>
          <select
            name="team_id"
            required
            disabled={!rosterId}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">
              {rosterId ? "Selecionar equipa..." : "Seleciona primeiro um roster"}
            </option>
            {teamsInRoster.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.escalao ? ` (${t.escalao})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
          <select name="role" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="assistant">Assistente</option>
            <option value="principal">Principal</option>
            <option value="analyst">Analista</option>
          </select>
        </div>
        <div>
          <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
            Atribuir
          </button>
        </div>
      </form>
      {rosterId && teamsInRoster.length === 0 && (
        <p className="text-sm text-amber-600 mt-3">⚠️ Este roster não tem equipas. Crie uma equipa primeiro.</p>
      )}
    </>
  );
}
