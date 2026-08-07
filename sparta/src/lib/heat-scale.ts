export interface HeatScale {
  toSizePx: (value: number) => number;
  toColor: (value: number) => string;
  legendGradient: string;
}

// Sequential color scale (baixo → alto): azul → âmbar → vermelho.
const COLOR_STOPS: { t: number; rgb: [number, number, number] }[] = [
  { t: 0,   rgb: [37, 99, 235] },  // blue-600
  { t: 0.5, rgb: [245, 158, 11] }, // amber-500
  { t: 1,   rgb: [220, 38, 38] },  // red-600
];

/**
 * Sequential size+color scale for "bubble" visualisations (weight, height, …)
 * — linear between [min, max], clamped outside that range.
 */
export function makeHeatScale(min: number, max: number, minSizePx = 24, maxSizePx = 64): HeatScale {
  function toT(value: number): number {
    const clamped = Math.max(min, Math.min(max, value));
    return (clamped - min) / (max - min);
  }

  function toSizePx(value: number): number {
    return Math.round(minSizePx + toT(value) * (maxSizePx - minSizePx));
  }

  function toColor(value: number): string {
    const t = toT(value);
    let lo = COLOR_STOPS[0]!;
    let hi = COLOR_STOPS[COLOR_STOPS.length - 1]!;
    for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
      const a = COLOR_STOPS[i]!;
      const b = COLOR_STOPS[i + 1]!;
      if (t >= a.t && t <= b.t) {
        lo = a;
        hi = b;
        break;
      }
    }
    const span = hi.t - lo.t || 1;
    const localT = (t - lo.t) / span;
    const r = Math.round(lo.rgb[0] + localT * (hi.rgb[0] - lo.rgb[0]));
    const g = Math.round(lo.rgb[1] + localT * (hi.rgb[1] - lo.rgb[1]));
    const b = Math.round(lo.rgb[2] + localT * (hi.rgb[2] - lo.rgb[2]));
    return `rgb(${r}, ${g}, ${b})`;
  }

  const legendGradient = `linear-gradient(to right, ${COLOR_STOPS.map(
    (s) => `rgb(${s.rgb.join(",")}) ${s.t * 100}%`
  ).join(", ")})`;

  return { toSizePx, toColor, legendGradient };
}
