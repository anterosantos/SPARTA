"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { getParentalConsentLink } from "@/lib/actions/consent";

interface CopyConsentLinkSheetProps {
  playerId: string;
}

export function CopyConsentLinkSheet({ playerId }: CopyConsentLinkSheetProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [parentName, setParentName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await getParentalConsentLink({ playerId, parentName });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.data.link);
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          window.location.reload();
        }, 1500);
      } catch {
        setError("Link gerado, mas não foi possível copiar automaticamente. Tenta novamente.");
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Copiar Link
      </Button>

      <DrillDownSheet open={open} onOpenChange={setOpen}>
        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
          <h2 className="text-base font-semibold mb-2">Consentimento parental RGPD</h2>
          <p className="text-sm text-muted-foreground">
            Gera um link de consentimento para partilhares por outro meio (ex.: WhatsApp). Não é enviado nenhum email.
          </p>
          <div className="space-y-1">
            <label htmlFor="parent-name" className="block text-sm font-medium">
              Nome do encarregado de educação *
            </label>
            <input
              id="parent-name"
              type="text"
              required
              placeholder="Nome de quem vai autorizar"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
              aria-invalid={!!error}
            />
          </div>

          {error && (
            <p className="text-sm text-signal-alert flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-signal-ok">Link copiado para a área de transferência.</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={isPending || success}>
              {isPending ? "A gerar…" : "Copiar link"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      </DrillDownSheet>
    </>
  );
}
