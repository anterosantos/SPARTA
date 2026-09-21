import {
  MATCH_ZONES,
  MATCH_ZONE_LABEL,
  LEGACY_MATCH_ZONES,
  LEGACY_MATCH_ZONE_LABEL,
  isLegacyZone,
  resolveZoneLabel,
} from "@/lib/schemas/match-events";
import { cn } from "@/lib/utils";

interface ZoneMiniPitchProps {
  /** Realça uma única zona (linha individual da lista de eventos). */
  highlightZone?: string;
  /** Contagem de eventos por zona — vista agregada tipo mapa de calor. */
  counts?: Partial<Record<string, number>>;
  size?: "sm" | "lg";
}

/**
 * Mini-campo com a mesma grelha do selector de zonas da captura de eventos —
 * realça a zona de um evento, ou a intensidade de eventos por zona quando
 * recebe `counts` (vista agregada).
 *
 * Um jogo é sempre capturado inteiramente num só esquema de zonas, por isso
 * o esquema (24 zonas activas, 4×6, ou 12 zonas legadas, 3×4) deriva-se das
 * zonas realmente presentes nos dados — jogos antigos continuam a mostrar-se
 * com o layout com que foram jogados, nunca reinterpretados como as novas 24.
 */
export function ZoneMiniPitch({ highlightZone, counts, size = "sm" }: ZoneMiniPitchProps) {
  const sampleZone = highlightZone ?? Object.keys(counts ?? {})[0];
  const useLegacy = sampleZone !== undefined && isLegacyZone(sampleZone);
  const zones = useLegacy ? LEGACY_MATCH_ZONES : MATCH_ZONES;
  const zoneLabelOf = useLegacy
    ? (z: string) => LEGACY_MATCH_ZONE_LABEL[z as (typeof LEGACY_MATCH_ZONES)[number]]
    : (z: string) => MATCH_ZONE_LABEL[z as (typeof MATCH_ZONES)[number]];

  const maxCount = counts
    ? Math.max(1, ...Object.values(counts).map((c) => c ?? 0))
    : 1;

  return (
    <div
      className={cn(
        useLegacy ? "grid-cols-3" : "grid-cols-4",
        "grid gap-[2px] shrink-0",
        size === "sm" ? "w-6" : "w-16 sm:w-20"
      )}
      role="img"
      aria-label={
        counts
          ? "Distribuição de eventos por zona do campo"
          : `Zona: ${highlightZone ? resolveZoneLabel(highlightZone) : "desconhecida"}`
      }
    >
      {zones.map((zone) => {
        const count = counts?.[zone] ?? 0;
        const isActive = highlightZone === zone;
        const zoneLabel = zoneLabelOf(zone);

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
