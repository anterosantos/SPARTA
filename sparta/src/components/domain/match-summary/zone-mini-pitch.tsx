import { MATCH_ZONES, MATCH_ZONE_LABEL } from "@/lib/schemas/match-events";
import { cn } from "@/lib/utils";

interface ZoneMiniPitchProps {
  /** Realça uma única zona (linha individual da lista de eventos). */
  highlightZone?: string;
  /** Contagem de eventos por zona — vista agregada tipo mapa de calor. */
  counts?: Partial<Record<string, number>>;
  size?: "sm" | "lg";
}

/** Mini-campo com a mesma grelha (3 colunas x 4 linhas) do selector de zonas
 * da captura de eventos — realça a zona de um evento, ou a intensidade de
 * eventos por zona quando recebe `counts` (vista agregada). */
export function ZoneMiniPitch({ highlightZone, counts, size = "sm" }: ZoneMiniPitchProps) {
  const maxCount = counts
    ? Math.max(1, ...Object.values(counts).map((c) => c ?? 0))
    : 1;

  return (
    <div
      className={cn("grid grid-cols-3 gap-[2px] shrink-0", size === "sm" ? "w-6" : "w-16 sm:w-20")}
      role="img"
      aria-label={
        counts
          ? "Distribuição de eventos por zona do campo"
          : `Zona: ${highlightZone ? (MATCH_ZONE_LABEL[highlightZone as (typeof MATCH_ZONES)[number]] ?? highlightZone) : "desconhecida"}`
      }
    >
      {MATCH_ZONES.map((zone) => {
        const count = counts?.[zone] ?? 0;
        const isActive = highlightZone === zone;
        const zoneLabel = MATCH_ZONE_LABEL[zone];

        return (
          <div
            key={zone}
            title={counts ? `${zoneLabel}: ${count}` : zoneLabel}
            className={cn(
              "rounded-[1px]",
              size === "sm" ? "h-2" : "h-4 sm:h-5",
              counts
                ? count > 0
                  ? "bg-primary"
                  : "bg-muted border border-border"
                : isActive
                  ? "bg-primary"
                  : "bg-muted border border-border"
            )}
            style={counts && count > 0 ? { opacity: 0.3 + (count / maxCount) * 0.7 } : undefined}
          />
        );
      })}
    </div>
  );
}
