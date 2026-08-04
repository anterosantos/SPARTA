"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PLAYER_SORT_OPTIONS, type PlayerSort } from "@/lib/utils/player-sort";

const SORT_LABELS: Record<PlayerSort, string> = {
  nome: "Nome",
  numero: "Número",
  posicao: "Posição",
};

interface PlantelListControlsProps {
  currentSort: PlayerSort;
  currentPosition: string | null;
  availablePositions: string[];
}

export function PlantelListControls({
  currentSort,
  currentPosition,
  availablePositions,
}: PlantelListControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: "ordenar" | "posicao", value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || (key === "ordenar" && value === "nome")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`?${params.toString()}`);
  }

  if (availablePositions.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Ordenar por" className="flex gap-1">
        {PLAYER_SORT_OPTIONS.map((sort) => {
          const isActive = currentSort === sort;
          return (
            <button
              key={sort}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={isActive ? undefined : () => setParam("ordenar", sort)}
              className={
                isActive
                  ? "bg-foreground text-background rounded px-3 py-1 text-sm font-medium"
                  : "text-ink-3 px-3 py-1 text-sm"
              }
            >
              {SORT_LABELS[sort]}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Posição</span>
        <select
          value={currentPosition ?? ""}
          onChange={(e) => setParam("posicao", e.target.value || null)}
          className="rounded border px-2 py-1 text-sm bg-background"
        >
          <option value="">Todas</option>
          {availablePositions.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
