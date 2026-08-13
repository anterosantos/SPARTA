"use client";

export interface AttendanceToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Mesmo padrão visual do toggle de ausência em /agenda/[sessionId] (absence-form.tsx). */
export function AttendanceToggle({
  checked,
  onChange,
  disabled = false,
}: AttendanceToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors",
        checked
          ? "border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
          : "border-border bg-card hover:bg-muted/40",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          checked ? "border-red-500 bg-red-500 text-white" : "border-muted-foreground",
        ].join(" ")}
        aria-hidden="true"
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="currentColor">
            <path
              d="M10 3L5 8.5 2 5.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        )}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">Não vou estar presente</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Informa o staff que não podes comparecer a esta sessão. O questionário pós-sessão fica indisponível.
        </p>
      </div>
    </button>
  );
}
