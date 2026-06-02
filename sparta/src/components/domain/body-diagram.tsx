"use client";

import type { MusclePainZone } from "@/lib/schemas/fatigue";

export const ZONE_LABELS_PT: Record<MusclePainZone, string> = {
  head:          "Cabeça",
  neck:          "Pescoço",
  shoulder_l:    "Ombro esquerdo",
  shoulder_r:    "Ombro direito",
  elbow_l:       "Cotovelo esquerdo",
  elbow_r:       "Cotovelo direito",
  wrist_l:       "Pulso esquerdo",
  wrist_r:       "Pulso direito",
  hand_l:        "Mão esquerda",
  hand_r:        "Mão direita",
  chest:         "Peito",
  abdomen:       "Barriga",
  back_upper_l:  "Costas superiores esquerda",
  back_upper_r:  "Costas superiores direita",
  back_lower_l:  "Costas inferiores esquerda",
  back_lower_r:  "Costas inferiores direita",
  hip_l:         "Anca esquerda",
  hip_r:         "Anca direita",
  thigh_l:       "Coxa esquerda",
  thigh_r:       "Coxa direita",
  knee_l:        "Joelho esquerdo",
  knee_r:        "Joelho direito",
  calf_l:        "Gémeos esquerdo",
  calf_r:        "Gémeos direito",
  ankle_l:       "Tornozelo esquerdo",
  ankle_r:       "Tornozelo direito",
  achilles_l:    "Tendão de Aquiles esquerdo",
  achilles_r:    "Tendão de Aquiles direito",
  foot_l:        "Pé esquerdo",
  foot_r:        "Pé direito",
};

// Coordenadas de cada zona no SVG (cx, cy, rx, ry)
// viewBox: 0 0 220 350
// "esquerdo/direito" refere-se ao lado DO JOGADOR (não do observador)
// Costas (back_*): ellipses laterais ao tronco — mesma linha de y mas fora da silhueta frontal
const ZONE_COORDS: Record<MusclePainZone, { cx: number; cy: number; rx: number; ry: number; back?: true }> = {
  // ── Cabeça / Pescoço ──────────────────────────────────────────────────────
  head:          { cx: 110, cy: 24,  rx: 17, ry: 21 },
  neck:          { cx: 110, cy: 52,  rx: 10, ry: 8  },

  // ── Ombros ────────────────────────────────────────────────────────────────
  shoulder_l:    { cx: 62,  cy: 72,  rx: 15, ry: 11 },
  shoulder_r:    { cx: 158, cy: 72,  rx: 15, ry: 11 },

  // ── Tronco (frente) — círculos centrais ───────────────────────────────────
  chest:         { cx: 110, cy: 90,  rx: 20, ry: 15 },
  abdomen:       { cx: 110, cy: 118, rx: 17, ry: 12 },

  // ── Tronco (costas) — 4 zonas laterais ao tronco, bordas tracejadas ───────
  // Posição: flanqueiam peito/barriga; sem sobreposição com cotovelos (x>56)
  back_upper_l:  { cx: 66,  cy: 90,  rx: 10, ry: 12, back: true },
  back_upper_r:  { cx: 154, cy: 90,  rx: 10, ry: 12, back: true },
  back_lower_l:  { cx: 66,  cy: 118, rx: 10, ry: 11, back: true },
  back_lower_r:  { cx: 154, cy: 118, rx: 10, ry: 11, back: true },

  // ── Braços ────────────────────────────────────────────────────────────────
  elbow_l:       { cx: 44,  cy: 106, rx: 12, ry: 10 },
  elbow_r:       { cx: 176, cy: 106, rx: 12, ry: 10 },
  wrist_l:       { cx: 34,  cy: 138, rx: 11, ry: 9  },
  wrist_r:       { cx: 186, cy: 138, rx: 11, ry: 9  },
  hand_l:        { cx: 30,  cy: 162, rx: 14, ry: 12 },
  hand_r:        { cx: 190, cy: 162, rx: 14, ry: 12 },

  // ── Ancas ─────────────────────────────────────────────────────────────────
  hip_l:         { cx: 82,  cy: 142, rx: 15, ry: 10 },
  hip_r:         { cx: 138, cy: 142, rx: 15, ry: 10 },

  // ── Pernas ────────────────────────────────────────────────────────────────
  thigh_l:       { cx: 80,  cy: 176, rx: 16, ry: 20 },
  thigh_r:       { cx: 140, cy: 176, rx: 16, ry: 20 },
  knee_l:        { cx: 78,  cy: 212, rx: 13, ry: 10 },
  knee_r:        { cx: 142, cy: 212, rx: 13, ry: 10 },
  calf_l:        { cx: 77,  cy: 242, rx: 12, ry: 16 },
  calf_r:        { cx: 143, cy: 242, rx: 12, ry: 16 },

  // ── Tornozelo / Aquiles / Pé ──────────────────────────────────────────────
  ankle_l:       { cx: 76,  cy: 270, rx: 11, ry: 8  },
  ankle_r:       { cx: 144, cy: 270, rx: 11, ry: 8  },
  achilles_l:    { cx: 76,  cy: 288, rx: 10, ry: 7  },
  achilles_r:    { cx: 144, cy: 288, rx: 10, ry: 7  },
  foot_l:        { cx: 78,  cy: 308, rx: 16, ry: 10 },
  foot_r:        { cx: 142, cy: 308, rx: 16, ry: 10 },
};

export interface BodyDiagramProps {
  selected: MusclePainZone[];
  onChange: (zones: MusclePainZone[]) => void;
  disabled?: boolean;
}

export function BodyDiagram({ selected, onChange, disabled = false }: BodyDiagramProps) {
  const selectedSet = new Set(selected);

  const toggle = (zone: MusclePainZone) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(zone)) {
      next.delete(zone);
    } else {
      next.add(zone);
    }
    onChange(Array.from(next) as MusclePainZone[]);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-medium text-foreground">
        Seleciona as zonas com dor ou desconforto
      </p>
      <p className="text-xs text-[var(--color-ink-3,theme(colors.gray.500))]">
        Toca nas zonas onde sentes dor. Podes selecionar mais do que uma.
        Zonas tracejadas = costas (lateral ao tronco).
      </p>

      {/* SVG do corpo — zero npm deps, funciona offline */}
      <svg
        viewBox="0 0 220 350"
        focusable="false"
        className="w-full max-w-[260px] select-none"
        style={{ touchAction: "none" }}
      >
        {/* ── Silhueta ─────────────────────────────────────────────────── */}
        {/* Cabeça */}
        <ellipse cx="110" cy="24" rx="18" ry="22"
          fill="none" stroke="currentColor" strokeWidth="1.2"
          className="text-[var(--color-hairline-strong,#D4D4D4)]" />
        {/* Pescoço */}
        <rect x="102" y="45" width="16" height="16" rx="4"
          fill="none" stroke="currentColor" strokeWidth="1.2"
          className="text-[var(--color-hairline-strong,#D4D4D4)]" />
        {/* Tronco */}
        <path d="M72 62 L148 62 L152 155 L68 155 Z"
          fill="none" stroke="currentColor" strokeWidth="1.2"
          className="text-[var(--color-hairline-strong,#D4D4D4)]" />
        {/* Braço esquerdo */}
        <rect x="28" y="63" width="22" height="105" rx="11"
          fill="none" stroke="currentColor" strokeWidth="1.2"
          className="text-[var(--color-hairline-strong,#D4D4D4)]" />
        {/* Braço direito */}
        <rect x="170" y="63" width="22" height="105" rx="11"
          fill="none" stroke="currentColor" strokeWidth="1.2"
          className="text-[var(--color-hairline-strong,#D4D4D4)]" />
        {/* Perna esquerda */}
        <rect x="63" y="155" width="28" height="155" rx="14"
          fill="none" stroke="currentColor" strokeWidth="1.2"
          className="text-[var(--color-hairline-strong,#D4D4D4)]" />
        {/* Perna direita */}
        <rect x="129" y="155" width="28" height="155" rx="14"
          fill="none" stroke="currentColor" strokeWidth="1.2"
          className="text-[var(--color-hairline-strong,#D4D4D4)]" />

        {/* ── Zonas interativas ─────────────────────────────────────────── */}
        {(Object.entries(ZONE_COORDS) as [MusclePainZone, typeof ZONE_COORDS[MusclePainZone]][]).map(
          ([zone, { cx, cy, rx, ry, back }]) => {
            const isSelected = selectedSet.has(zone);
            return (
              <ellipse
                key={zone}
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill={isSelected ? "var(--signal-alert-bg,#FEF2F2)" : "transparent"}
                stroke={
                  isSelected
                    ? "var(--signal-alert-ink,#991B1B)"
                    : "var(--color-hairline,#E5E5E5)"
                }
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={back && !isSelected ? "3 2" : undefined}
                className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-80"}
                role="button"
                aria-label={`${ZONE_LABELS_PT[zone]}${isSelected ? " — seleccionado" : ""}`}
                aria-pressed={isSelected}
                tabIndex={disabled ? -1 : 0}
                onClick={() => toggle(zone)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(zone);
                  }
                }}
              />
            );
          }
        )}

        {/* Legenda: identifica os dois pares de back zones laterais */}
        <text x="110" y="78" fontSize="6.5" fill="currentColor"
          className="text-[var(--color-ink-4,#A3A3A3)]"
          textAnchor="middle">peito · costas</text>
        <text x="110" y="134" fontSize="6.5" fill="currentColor"
          className="text-[var(--color-ink-4,#A3A3A3)]"
          textAnchor="middle">barriga · costas</text>
      </svg>

      {/* Chips das zonas seleccionadas */}
      {selected.length > 0 && (
        <div
          className="w-full rounded-lg border border-[var(--signal-alert-bg,#FEF2F2)] bg-[var(--signal-alert-bg,#FEF2F2)] px-3 py-2"
          aria-live="polite"
        >
          <p className="text-xs font-medium text-[var(--signal-alert-ink,#991B1B)]">
            Zonas seleccionadas:
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {selected.map((z) => (
              <li key={z}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(z)}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-[var(--signal-alert-ink,#991B1B)] ring-1 ring-[var(--signal-alert-ink,#991B1B)] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Remover ${ZONE_LABELS_PT[z]}`}
                >
                  {ZONE_LABELS_PT[z]}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
