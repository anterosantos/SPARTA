"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { declarePlayerAbsence, cancelPlayerAbsence } from "@/lib/actions/player-attendance";
import type { AttendanceStatus } from "@/lib/schemas/attendances";

interface AbsenceFormProps {
  sessionId: string;
  initialStatus: AttendanceStatus | null;
  initialNote: string | null;
}

export function AbsenceForm({ sessionId, initialStatus, initialNote }: AbsenceFormProps) {
  const router = useRouter();
  const [isAbsent, setIsAbsent] = useState(initialStatus === "absent");
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = isAbsent
      ? await declarePlayerAbsence({ session_id: sessionId, note: note.trim() || undefined })
      : await cancelPlayerAbsence({ session_id: sessionId });

    setSaving(false);

    if (!result.ok) {
      setError(result.error.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/agenda"), 1500);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {/* Absence toggle */}
      <button
        type="button"
        role="checkbox"
        aria-checked={isAbsent}
        onClick={() => { setIsAbsent((v) => !v); setSuccess(false); }}
        className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
          isAbsent
            ? "border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
            : "border-border bg-card hover:bg-muted/40"
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            isAbsent
              ? "border-red-500 bg-red-500 text-white"
              : "border-muted-foreground"
          }`}
          aria-hidden="true"
        >
          {isAbsent && (
            <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Não vou estar presente</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Informa o staff que não podes comparecer a esta sessão
          </p>
        </div>
      </button>

      {/* Justification — only shown when absent */}
      {isAbsent && (
        <div className="space-y-1.5">
          <label htmlFor="note" className="text-sm font-medium text-foreground">
            Justificação <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ex.: lesão, compromisso escolar, doença..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
        </div>
      )}

      {/* Feedback */}
      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p role="status" className="text-sm text-green-600 dark:text-green-400">
          {isAbsent ? "Ausência registada." : "Declaração cancelada."}
        </p>
      )}

      <Button
        type="submit"
        variant={isAbsent ? "destructive" : "primary"}
        className="w-full"
        disabled={saving}
      >
        {saving ? "A guardar…" : isAbsent ? "Confirmar ausência" : "Guardar"}
      </Button>
    </form>
  );
}
