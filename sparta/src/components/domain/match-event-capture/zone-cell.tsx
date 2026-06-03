"use client";

import { forwardRef } from "react";
import type { MATCH_ZONES } from "@/lib/schemas/match-events";
import { cn } from "@/lib/utils";

type MatchZone = (typeof MATCH_ZONES)[number];

interface ZoneCellProps {
  zone: MatchZone;
  onClick?: (zone: MatchZone) => void;
  disabled?: boolean;
}

const ZONES_MAP: Record<MatchZone, string> = {
  def_left: "Defesa esquerda",
  def_center: "Defesa centro",
  def_right: "Defesa direita",
  mid_def_left: "MC defensivo esq.",
  mid_def_center: "MC defensivo centro",
  mid_def_right: "MC defensivo dir.",
  mid_att_left: "MC ofensivo esq.",
  mid_att_center: "MC ofensivo centro",
  mid_att_right: "MC ofensivo dir.",
  att_left: "Ataque esquerda",
  att_center: "Ataque centro",
  att_right: "Ataque direita",
};

export const ZoneCell = forwardRef<HTMLButtonElement, ZoneCellProps>(
  ({ zone, onClick, disabled }, ref) => {
    const label = ZONES_MAP[zone] ?? zone;

    return (
      <button
        ref={ref}
        onClick={() => !disabled && onClick?.(zone)}
        disabled={disabled}
        role="gridcell"
        aria-label={label}
        className={cn(
          "w-full h-full rounded-lg border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-800",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
        )}
      >
        <span className="text-sm font-medium text-center px-2">{label}</span>
      </button>
    );
  }
);

ZoneCell.displayName = "ZoneCell";
