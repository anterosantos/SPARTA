"use client";

import { useState } from "react";
import { revokeReport, shareReport } from "@/lib/actions/reports";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { Button } from "@/components/ui/button";
import type { PdfReport } from "@/lib/actions/reports";

const SCOPE_LABELS: Record<string, string> = {
  match: "Jogos",
  training: "Treinos",
  period: "Período",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT");
}

function isActive(expiresAt: string): boolean {
  return new Date(expiresAt) > new Date();
}

interface Props {
  report: PdfReport;
}

export function RelatorioRow({ report }: Props) {
  const [showRevoke, setShowRevoke] = useState(false);
  const [showShareInput, setShowShareInput] = useState(false);
  const [shareEmail, setShareEmail] = useState(report.shared_with_email ?? "");
  const [revokeSuccess, setRevokeSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);

  const active = isActive(report.expires_at) && !isRevoked;

  async function handleRevoke() {
    setIsPending(true);
    setRevokeError(null);
    const result = await revokeReport(report.id);
    setIsPending(false);
    setShowRevoke(false);
    if (result.ok) {
      setIsRevoked(true);
      setRevokeSuccess(true);
    } else {
      setRevokeError(result.error.message);
    }
  }

  async function handleShare() {
    if (!shareEmail.includes("@")) {
      setShareError("Introduza um email válido.");
      return;
    }
    setIsPending(true);
    setShareError(null);
    const result = await shareReport(report.id, shareEmail);
    setIsPending(false);
    setShowShareInput(false);
    if (result.ok) {
      setShareSuccess(true);
    } else {
      setShareError(result.error.message);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {SCOPE_LABELS[report.scope] ?? report.scope}
            {" — "}
            {formatDate(report.period_start)} a {formatDate(report.period_end)}
          </p>
          <p className="text-xs text-muted-foreground">
            Gerado em {formatDate(report.generated_at)}
          </p>
          <p className="text-xs text-muted-foreground">
            Partilhado com:{" "}
            {report.shared_with_email ?? "(não partilhado)"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            active
              ? "bg-green-100 text-green-800"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {active ? "Activo" : "Expirado"}
        </span>
      </div>

      {revokeSuccess && <CalmConfirmation message="Link revogado com sucesso." />}
      {shareSuccess && <CalmConfirmation message="Relatório partilhado com sucesso." />}
      {revokeError && (
        <p role="alert" className="text-xs text-destructive">{revokeError}</p>
      )}
      {shareError && (
        <p role="alert" className="text-xs text-destructive">{shareError}</p>
      )}

      {/* Botão reenviar */}
      {active && !showShareInput && !revokeSuccess && (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowShareInput(true)}
            disabled={isPending}
          >
            Reenviar link
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowRevoke(true)}
            disabled={isPending}
          >
            Revogar link
          </Button>
        </div>
      )}

      {/* Input de email para partilha */}
      {showShareInput && (
        <div className="flex gap-2">
          <input
            type="email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" onClick={handleShare} disabled={isPending}>
            {isPending ? "A enviar..." : "Enviar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowShareInput(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Confirmação de revogação */}
      {showRevoke && (
        <div className="rounded-md bg-destructive/10 p-3 space-y-2">
          <p className="text-sm text-destructive">
            Confirmar revogação? O ficheiro será eliminado e o link deixará de funcionar.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRevoke}
              disabled={isPending}
            >
              {isPending ? "A revogar..." : "Confirmar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRevoke(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
