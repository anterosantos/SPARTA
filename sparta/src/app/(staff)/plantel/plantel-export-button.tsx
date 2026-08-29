"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportPlayersCsv } from "@/lib/utils/export";
import type { PlayerExportRow } from "@/lib/actions/players";

interface PlantelExportButtonProps {
  players: PlayerExportRow[];
}

export function PlantelExportButton({ players }: PlantelExportButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => exportPlayersCsv(players)}
      disabled={players.length === 0}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Exportar
    </Button>
  );
}
