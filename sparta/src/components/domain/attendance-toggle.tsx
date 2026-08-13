"use client";

export interface AttendanceToggleProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function AttendanceToggle({
  value,
  onChange,
  disabled = false,
}: AttendanceToggleProps) {
  const label = "Vais participar nesta sessão?";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs text-[var(--color-ink-3,theme(colors.gray.500))]">
            Se não puderes comparecer, o staff é notificado e o questionário pós-sessão fica indisponível.
          </span>
        </div>

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
