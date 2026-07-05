"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface RosterFilterProps {
  rosters: { id: string; name: string }[];
  activeRosterId?: string;
}

export function RosterFilter({ rosters, activeRosterId }: RosterFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(rosterId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!rosterId) {
      params.delete("roster_id");
    } else {
      params.set("roster_id", rosterId);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="roster_filter" className="text-sm font-medium text-gray-700">
        Filtrar por Roster
      </label>
      <select
        id="roster_filter"
        value={activeRosterId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Todos os rosters</option>
        {rosters.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
