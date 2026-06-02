"use client";

import type { MusclePainZone } from "@/lib/schemas/fatigue";

// Mapeamento de zonas para labels PT-PT
const ZONE_LABELS: Record<MusclePainZone, string> = {
  neck: "Pescoço",
  shoulder_l: "Ombro esquerdo",
  shoulder_r: "Ombro direito",
  elbow_l: "Cotovelo esquerdo",
  elbow_r: "Cotovelo direito",
  wrist_l: "Pulso esquerdo",
  wrist_r: "Pulso direito",
  back_upper: "Costas (parte superior)",
  back_lower: "Costas (parte inferior)",
  hip_l: "Anca esquerda",
  hip_r: "Anca direita",
  knee_l: "Joelho esquerdo",
  knee_r: "Joelho direito",
  ankle_l: "Tornozelo esquerdo",
  ankle_r: "Tornozelo direito",
  achilles_l: "Tendão de Aquiles esquerdo",
  achilles_r: "Tendão de Aquiles direito",
  other: "Outra zona",
};

// Coordenadas de cada zona no SVG (cx, cy, rx, ry)
const ZONE_ELLIPSES: Record<MusclePainZone, { cx: number; cy: number; rx: number; ry: number }> = {
  neck:        { cx: 100, cy: 52,  rx: 14, ry: 10 },
  shoulder_l:  { cx: 63,  cy: 80,  rx: 16, ry: 12 },
  shoulder_r:  { cx: 137, cy: 80,  rx: 16, ry: 12 },
  elbow_l:     { cx: 48,  cy: 120, rx: 13, ry: 10 },
  elbow_r:     { cx: 152, cy: 120, rx: 13, ry: 10 },
  wrist_l:     { cx: 38,  cy: 155, rx: 12, ry: 9  },
  wrist_r:     { cx: 162, cy: 155, rx: 12, ry: 9  },
  back_upper:  { cx: 100, cy: 100, rx: 22, ry: 16 },
  back_lower:  { cx: 100, cy: 130, rx: 20, ry: 14 },
  hip_l:       { cx: 78,  cy: 162, rx: 16, ry: 11 },
  hip_r:       { cx: 122, cy: 162, rx: 16, ry: 11 },
  knee_l:      { cx: 76,  cy: 210, rx: 14, ry: 11 },
  knee_r:      { cx: 124, cy: 210, rx: 14, ry: 11 },
  ankle_l:     { cx: 74,  cy: 255, rx: 12, ry: 9  },
  ankle_r:     { cx: 126, cy: 255, rx: 12, ry: 9  },
  achilles_l:  { cx: 72,  cy: 272, rx: 10, ry: 8  },
  achilles_r:  { cx: 128, cy: 272, rx: 10, ry: 8  },
  other:       { cx: 100, cy: 295, rx: 18, ry: 10 },
};

export interface BodyDiagramProps {
  /** Zonas actualmente seleccionadas */
  selected: MusclePainZone[];
  /** Callback chamado quando o utilizador clica uma zona */
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
      </p>

      {/* SVG do corpo — zero npm deps, funciona offline */}
      {/* SVG sem role=img para evitar nested-interactive; botões internos têm aria próprio */}
      <svg
        viewBox="0 0 200 320"
        focusable="false"
        className="w-full max-w-[220px] select-none"
        style={{ touchAction: "none" }}
      >
        {/* Silhueta básica do corpo (frente) */}
        {/* Cabeça */}
        <ellipse cx="100" cy="28" rx="18" ry="22"
          fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-hairline-strong,theme(colors.neutral.300))]" />
        {/* Tronco */}
        <rect x="74" y="64" width="52" height="82" rx="8"
          fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-hairline-strong,theme(colors.neutral.300))]" />
        {/* Braço esquerdo */}
        <rect x="36" y="68" width="18" height="95" rx="9"
          fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-hairline-strong,theme(colors.neutral.300))]" />
        {/* Braço direito */}
        <rect x="146" y="68" width="18" height="95" rx="9"
          fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-hairline-strong,theme(colors.neutral.300))]" />
        {/* Perna esquerda */}
        <rect x="68" y="152" width="26" height="130" rx="13"
          fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-hairline-strong,theme(colors.neutral.300))]" />
        {/* Perna direita */}
        <rect x="106" y="152" width="26" height="130" rx="13"
          fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-hairline-strong,theme(colors.neutral.300))]" />

        {/* Zonas tappable */}
        {(Object.entries(ZONE_ELLIPSES) as [MusclePainZone, { cx: number; cy: number; rx: number; ry: number }][]).map(
          ([zone, { cx, cy, rx, ry }]) => {
            const isSelected = selectedSet.has(zone);
            return (
              <ellipse
                key={zone}
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill={isSelected ? "var(--signal-alert-bg,#FEF2F2)" : "transparent"}
                stroke={isSelected ? "var(--signal-alert-ink,#991B1B)" : "var(--color-hairline,#E5E5E5)"}
                strokeWidth={isSelected ? 2 : 1}
                className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-80"}
                role="button"
                aria-label={`${ZONE_LABELS[zone]}${isSelected ? " — seleccionado" : ""}`}
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
      </svg>

      {/* Lista das zonas seleccionadas (leitura por screen reader) */}
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
                  aria-label={`Remover ${ZONE_LABELS[z]}`}
                >
                  {ZONE_LABELS[z]}
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
