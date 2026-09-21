"use client";

import { forwardRef } from "react";
import { MATCH_ZONE_LABEL, type MATCH_ZONES } from "@/lib/schemas/match-events";
import { cn } from "@/lib/utils";

type MatchZone = (typeof MATCH_ZONES)[number];
export type ZoneAccentSide = "top" | "right" | "bottom" | "left";
export type ZoneAccentColor = "white" | "green" | "red";

const ACCENT_HEX: Record<ZoneAccentColor, string> = {
  white: "#ffffff",
  green: "#22c55e",
  red: "#ef4444",
};

interface ZoneCellProps {
  zone: MatchZone;
  onClick?: (zone: MatchZone) => void;
  disabled?: boolean;
  /**
   * Lados com linha grossa de destaque (divisória de meio-campo, caixa de
   * ataque/perigo, etc.) — aplicado via `style` inline (não classes Tailwind)
   * para nunca entrar em conflito de cascata com a borda por omissão, que só
   * cobre os lados não listados aqui.
   */
  accentBorders?: Partial<Record<ZoneAccentSide, ZoneAccentColor>>;
}

export const ZoneCell = forwardRef<HTMLButtonElement, ZoneCellProps>(
  ({ zone, onClick, disabled, accentBorders }, ref) => {
    const label = MATCH_ZONE_LABEL[zone] ?? zone;

    const style: React.CSSProperties = {};
    if (accentBorders) {
      for (const side of Object.keys(accentBorders) as ZoneAccentSide[]) {
        const color = accentBorders[side];
        if (!color) continue;
        const prop = `border${side[0]!.toUpperCase()}${side.slice(1)}` as
          | "borderTop"
          | "borderRight"
          | "borderBottom"
          | "borderLeft";
        style[`${prop}Width`] = "4px";
        style[`${prop}Color`] = ACCENT_HEX[color];
        style[`${prop}Style`] = "solid";
      }
    }

    return (
      <button
        ref={ref}
        style={style}
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
