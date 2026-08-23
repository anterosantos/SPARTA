import { DIMENSION_ORDER, DIMENSION_LABELS, DIMENSION_COLORS } from "./FatigueSparkline";

/** Legenda das 5 dimensões representadas nas mini-tendências — sem isto, as 5 linhas
 * coloridas por jogador não são identificáveis sem passar o rato/leitor de ecrã por
 * cima (só têm aria-label). */
export function FatigueTrendsLegend() {
  return (
    <ul
      className="flex flex-wrap gap-x-4 gap-y-1.5 list-none p-0 m-0"
      aria-label="Legenda das dimensões de fadiga"
    >
      {DIMENSION_ORDER.map((dim) => (
        <li key={dim} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: DIMENSION_COLORS[dim] }}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">{DIMENSION_LABELS[dim]}</span>
        </li>
      ))}
    </ul>
  );
}
