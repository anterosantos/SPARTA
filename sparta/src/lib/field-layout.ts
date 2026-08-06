/**
 * Shared pitch-layout math for SVG field visualisations (viewBox 300×400,
 * origin top-left, our goal at the bottom / attack direction upward).
 * Used by field-formation.tsx (prontidão) and any other component that
 * positions players on a football pitch by primary position.
 */
import { getPositionKey } from "@/components/domain/readiness/readiness-panel-list";

export interface PositionCoords {
  xPct: number;
  yPct: number;
  halfSpan: number;
}

// Coordinates per sub-position (% of SVG viewBox).
export const POSITION_COORDS: Record<string, PositionCoords> = {
  GR:  { xPct: 50, yPct: 89, halfSpan: 12 },
  DC:  { xPct: 50, yPct: 76, halfSpan: 14 },
  DD:  { xPct: 80, yPct: 76, halfSpan:  6 },
  DE:  { xPct: 20, yPct: 76, halfSpan:  6 },
  LIB: { xPct: 50, yPct: 69, halfSpan:  7 },
  MDC: { xPct: 50, yPct: 57, halfSpan:  7 },
  MC:  { xPct: 50, yPct: 45, halfSpan:  8 },
  MO:  { xPct: 50, yPct: 33, halfSpan:  7 },
  MD:  { xPct: 72, yPct: 45, halfSpan:  7 },
  ME:  { xPct: 28, yPct: 45, halfSpan:  7 },
  EXD: { xPct: 76, yPct: 28, halfSpan:  7 },
  EXE: { xPct: 24, yPct: 28, halfSpan:  7 },
  SC:  { xPct: 50, yPct: 20, halfSpan:  8 },
  PL:  { xPct: 50, yPct: 15, halfSpan:  7 },
};

// Fallback coordinates when primaryPosition holds a canonical group name (DEF/MED/AVA)
export const FALLBACK_COORDS: Record<string, PositionCoords> = {
  DEF: { xPct: 50, yPct: 76, halfSpan: 10 },
  MED: { xPct: 50, yPct: 45, halfSpan: 10 },
  AVA: { xPct: 50, yPct: 28, halfSpan: 10 },
};

export const DEFAULT_COORDS: PositionCoords = { xPct: 50, yPct: 44, halfSpan: 14 };

// Positions that always render in a single horizontal line regardless of player count.
export const SINGLE_ROW_POSITIONS = new Set(["GR"]);

export function getCoords(position: string | null): PositionCoords {
  if (!position) return DEFAULT_COORDS;
  const trimmed = position.trim();
  if (!trimmed) return DEFAULT_COORDS;
  const upper = trimmed.toUpperCase();
  const direct = POSITION_COORDS[upper];
  if (direct) return direct;
  const group = getPositionKey(position);
  const fallback = FALLBACK_COORDS[group];
  if (!fallback) {
    console.warn(`Unknown position group for "${position}", using default centered position`);
  }
  return fallback ?? DEFAULT_COORDS;
}

// Returns a unique group key for an item — sub-position if known, canonical group otherwise.
export function groupKey(position: string | null): string {
  if (!position) return "MED";
  const upper = position.trim().toUpperCase();
  if (POSITION_COORDS[upper]) return upper;
  const canonical = getPositionKey(position);
  if (!canonical || typeof canonical !== "string") {
    console.warn(`groupKey returned unexpected value "${canonical}" for position "${position}"`);
    return "MED";
  }
  return canonical;
}

export function spreadHorizontal(count: number, baseXPct: number, halfSpan: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [baseXPct];
  return Array.from({ length: count }, (_, i) => {
    const x = baseXPct - halfSpan + (i * (halfSpan * 2)) / (count - 1);
    return Math.max(8, Math.min(92, x));
  });
}

export interface PositionedItem<T> {
  item: T;
  xPct: number;
  yPct: number;
  positionKey: string;
}

/**
 * Groups items by canonical position, spreads each group horizontally (with a
 * staggered second row once a group has 3+ items), and clamps x within [8, 92].
 */
export function layoutByPosition<T>(
  items: T[],
  getPosition: (item: T) => string | null
): PositionedItem<T>[] {
  const grouped = new Map<string, { items: T[]; xPct: number; yPct: number; halfSpan: number }>();

  for (const item of items) {
    const key = groupKey(getPosition(item));
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      const coords = getCoords(getPosition(item));
      grouped.set(key, { items: [item], ...coords });
    }
  }

  const result: PositionedItem<T>[] = [];
  const ROW_Y_OFFSET = 4; // % of container height; creates two staggered rows for large groups

  for (const [posKey, { items: group, xPct, yPct, halfSpan }] of grouped.entries()) {
    if (group.length < 3 || SINGLE_ROW_POSITIONS.has(posKey)) {
      const xPositions = spreadHorizontal(group.length, xPct, halfSpan);
      for (let i = 0; i < group.length; i++) {
        const item = group[i];
        const x = xPositions[i];
        if (item !== undefined && x !== undefined) {
          result.push({ item, xPct: Math.max(8, Math.min(92, x)), yPct, positionKey: posKey });
        }
      }
    } else {
      const row1Count = Math.ceil(group.length / 2);
      const row2Count = group.length - row1Count;
      const row1 = group.slice(0, row1Count);
      const row2 = group.slice(row1Count);

      const xPos1 = spreadHorizontal(row1Count, xPct, halfSpan);
      for (let i = 0; i < row1.length; i++) {
        const item = row1[i];
        const x = xPos1[i];
        if (item !== undefined && x !== undefined) {
          result.push({ item, xPct: Math.max(8, Math.min(92, x)), yPct: yPct - ROW_Y_OFFSET, positionKey: posKey });
        }
      }

      const xPos2 = spreadHorizontal(row2Count, xPct, halfSpan);
      for (let i = 0; i < row2.length; i++) {
        const item = row2[i];
        const x = xPos2[i];
        if (item !== undefined && x !== undefined) {
          result.push({ item, xPct: Math.max(8, Math.min(92, x)), yPct: yPct + ROW_Y_OFFSET, positionKey: posKey });
        }
      }
    }
  }

  return result;
}
