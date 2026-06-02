"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { generateReport } from "@/lib/actions/reports";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { Button } from "@/components/ui/button";
import type { ReportScope } from "@/lib/actions/reports";

const formSchema = z
  .object({
    scope: z.enum(["match", "training", "period"]),
    periodStart: z.string().min(1, "Data de início obrigatória"),
    periodEnd: z.string().min(1, "Data de fim obrigatória"),
    sharedEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  })
  .refine((d) => d.periodStart <= d.periodEnd, {
    message: "A data de início deve ser anterior ou igual à data de fim",
    path: ["periodEnd"],
  });

type FormValues = z.infer<typeof formSchema>;

const SCOPE_LABELS: Record<ReportScope, string> = {
  match: "Jogos",
  training: "Treinos",
  period: "Período",
};

interface Props {
  playerId: string;
}

export function RelatorioPdfForm({ playerId }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [processingRestricted, setProcessingRestricted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { scope: "period", periodStart: "", periodEnd: "", sharedEmail: "" },
  });

  async function onSubmit(values: FormValues) {
    setSignedUrl(null);
    setProcessingRestricted(false);
    setServerError(null);

    const result = await generateReport(playerId, {
      scope: values.scope,
      periodStart: values.periodStart,
      periodEnd: values.periodEnd,
      sharedEmail: values.sharedEmail || undefined,
    });

    if (!result.ok) {
      if (result.error.code === "processing_restricted") {
        setProcessingRestricted(true);
      } else {
        setServerError(result.error.message);
      }
      return;
    }

    try {
      const url = new URL(result.data.signedUrl);
      if (url.protocol !== "https:") {
        setServerError("URL de download inválida.");
        return;
      }
    } catch {
      setServerError("URL de download inválida.");
      return;
    }
    setSignedUrl(result.data.signedUrl);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Âmbito */}
      <div className="space-y-1">
        <label htmlFor="scope" className="text-sm font-medium">
          Âmbito
        </label>
        <select
          id="scope"
          {...register("scope")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {Object.entries(SCOPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.scope && (
          <p className="text-xs text-destructive">{errors.scope.message}</p>
        )}
      </div>

      {/* Período */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="periodStart" className="text-sm font-medium">
            Início do período
          </label>
          <input
            id="periodStart"
            type="date"
            {...register("periodStart")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.periodStart && (
            <p className="text-xs text-destructive">{errors.periodStart.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="periodEnd" className="text-sm font-medium">
            Fim do período
          </label>
          <input
            id="periodEnd"
            type="date"
            {...register("periodEnd")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.periodEnd && (
            <p className="text-xs text-destructive">{errors.periodEnd.message}</p>
          )}
        </div>
      </div>

      {/* Email opcional */}
      <div className="space-y-1">
        <label htmlFor="sharedEmail" className="text-sm font-medium">
          Partilhar por email{" "}
          <span className="text-xs text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="sharedEmail"
          type="email"
          {...register("sharedEmail")}
          placeholder="exemplo@email.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.sharedEmail && (
          <p className="text-xs text-destructive">{errors.sharedEmail.message}</p>
        )}
      </div>

      {/* Erros */}
      {processingRestricted && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Não é possível gerar relatório — processamento restringido por pedido GDPR.
        </p>
      )}
      {serverError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      {/* Sucesso */}
      {signedUrl && (
        <div className="rounded-md bg-muted p-4 space-y-3">
          <CalmConfirmation message="Relatório gerado com sucesso." />
          <p className="text-sm">
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:text-primary"
            >
              Descarregar relatório
            </a>
            {" "}
            <span className="text-xs text-muted-foreground">(link válido por 30 dias)</span>
          </p>
          <p className="text-xs text-muted-foreground">
            <Link href={`/plantel/${playerId}/relatorios`} className="underline underline-offset-2">
              Ver histórico de relatórios
            </Link>
          </p>
        </div>
      )}

      {/* Aviso de tempo */}
      {isSubmitting && (
        <p className="text-xs text-muted-foreground">
          A gerar relatório... pode demorar até 15 segundos.
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "A gerar..." : "Gerar relatório"}
      </Button>
    </form>
  );
}
