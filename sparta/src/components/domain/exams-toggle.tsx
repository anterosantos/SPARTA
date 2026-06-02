"use client";

export interface ExamsToggleProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Grupo etário — sub-14 usa copy simplificado */
  ageGroup?: "senior" | "u14";
}

export function ExamsToggle({
  value,
  onChange,
  disabled = false,
  ageGroup = "senior",
}: ExamsToggleProps) {
  const label =
    ageGroup === "u14"
      ? "Tens testes ou exames esta semana?"
      : "Tens testes ou exames esta semana?";

  const helpText =
    ageGroup === "u14"
      ? "Isso pode afetar o teu cansaço e a tua concentração."
      : "Esta informação ajuda a contextualizar a carga de treino.";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs text-[var(--color-ink-3,theme(colors.gray.500))]">
            {helpText}
          </span>
        </div>

        {/* Toggle — dois botões explícitos para melhor a11y */}
        <div
          role="group"
          aria-label={label}
          className="flex shrink-0 gap-1"
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(true)}
            aria-pressed={value === true}
            className={[
              "min-h-[44px] min-w-[56px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              value === true
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            Sim
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(false)}
            aria-pressed={value === false}
            className={[
              "min-h-[44px] min-w-[56px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              value === false
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            Não
          </button>
        </div>
      </div>
    </div>
  );
}
