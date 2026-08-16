"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import {
  getMySchoolSchedule,
  saveMySchoolSchedule,
} from "@/lib/actions/school-schedule";
import { SaveSchoolScheduleInputSchema } from "@/lib/schemas/school-schedule";

type FormValues = z.input<typeof SaveSchoolScheduleInputSchema>;

const DAY_FIELDS = [
  { key: "mon_time", label: "Segunda" },
  { key: "tue_time", label: "Terça" },
  { key: "wed_time", label: "Quarta" },
  { key: "thu_time", label: "Quinta" },
  { key: "fri_time", label: "Sexta" },
] as const;

const EMPTY_TERM = { startDate: "", endDate: "" };

/** Converte "" (input HTML vazio) em null antes de validar/gravar. */
function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return value;
}

export function SchoolScheduleForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"same" | "different">("same");
  const [uniformTime, setUniformTime] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(SaveSchoolScheduleInputSchema),
    defaultValues: {
      weekly: {
        mon_time: null,
        tue_time: null,
        wed_time: null,
        thu_time: null,
        fri_time: null,
      },
      terms: [EMPTY_TERM],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "terms",
  });

  // Carregar horário existente (se já preenchido) para pré-preencher o formulário.
  // Cleanup: abort async se component unmount antes de completar.
  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialSchedule() {
      try {
        const result = await getMySchoolSchedule();
        // Verificar se foi aborted antes de setState
        if (controller.signal.aborted) return;

        if (result.ok) {
          const { weekly, terms } = result.data;
          form.reset({
            weekly,
            terms: terms.length > 0 ? terms : [EMPTY_TERM],
          });

          const dayValues = [
            weekly.mon_time,
            weekly.tue_time,
            weekly.wed_time,
            weekly.thu_time,
            weekly.fri_time,
          ];
          const filled = dayValues.filter((v) => v != null);
          const allSame =
            filled.length > 0 && filled.every((v) => v === filled[0]);
          if (allSame) {
            setMode("same");
            setUniformTime(filled[0] ?? "");
          } else if (filled.length > 0) {
            setMode("different");
          }
        } else {
          if (!controller.signal.aborted) {
            setLoadError(result.error.message);
          }
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setLoadError(e instanceof Error ? e.message : "Erro ao carregar horário");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialSchedule();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só corre uma vez ao montar
  }, []);

  function handleUniformTimeChange(value: string) {
    setUniformTime(value);
    for (const { key } of DAY_FIELDS) {
      form.setValue(`weekly.${key}`, normalizeTime(value), {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }

  function handleModeChange(next: "same" | "different") {
    if (next === "same" && mode === "different") {
      // Avisar que vai sobrescrever as horas diferentes com a hora uniforme
      const filled = [
        form.getValues("weekly.mon_time"),
        form.getValues("weekly.tue_time"),
        form.getValues("weekly.wed_time"),
        form.getValues("weekly.thu_time"),
        form.getValues("weekly.fri_time"),
      ].filter((v) => v != null);

      if (filled.length > 0 && !filled.every((v) => v === filled[0])) {
        // eslint-disable-next-line no-alert -- confirmação para mudança irreversível
        if (!confirm("Isto vai sobrescrever as tuas horas diferentes com uma hora uniforme. Continua?")) {
          return;
        }
      }
    }

    setMode(next);
    if (next === "same") {
      handleUniformTimeChange(uniformTime);
    }
  }

  function onSubmit(data: FormValues) {
    setSubmitError(null);
    const payload = {
      weekly: {
        mon_time: normalizeTime(data.weekly.mon_time),
        tue_time: normalizeTime(data.weekly.tue_time),
        wed_time: normalizeTime(data.weekly.wed_time),
        thu_time: normalizeTime(data.weekly.thu_time),
        fri_time: normalizeTime(data.weekly.fri_time),
      },
      terms: data.terms,
    };

    startTransition(async () => {
      const result = await saveMySchoolSchedule(payload);
      if (!result.ok) {
        setSubmitError(result.error.message);
        return;
      }
      setShowSaved(true);
    });
  }

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" aria-busy="true">
        A carregar horário...
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {showSaved && (
        <CalmConfirmation message="Horário guardado" onDismiss={() => setShowSaved(false)} />
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Indica a hora a que sais da escola em cada dia útil. Usamos este horário para
          antecipar se podes chegar atrasado a uma sessão (assumindo 60 minutos de
          deslocação).
        </p>

        {/* Toggle: mesma hora todos os dias / horas diferentes */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Horário de saída</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "same" ? "primary" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("same")}
              disabled={isPending}
            >
              Mesma hora todos os dias
            </Button>
            <Button
              type="button"
              variant={mode === "different" ? "primary" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("different")}
              disabled={isPending}
            >
              Horas diferentes
            </Button>
          </div>

          {mode === "same" ? (
            <div className="space-y-1">
              <label htmlFor="uniform-time" className="text-sm text-muted-foreground">
                Hora de saída (Seg–Sex)
              </label>
              <input
                id="uniform-time"
                type="time"
                className="w-full rounded border px-3 py-2 text-sm"
                value={uniformTime}
                onChange={(e) => handleUniformTimeChange(e.target.value)}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Deixa em branco se não tens aulas nesse período.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {DAY_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label htmlFor={`day-${key}`} className="w-20 text-sm text-muted-foreground">
                    {label}
                  </label>
                  <input
                    id={`day-${key}`}
                    type="time"
                    className="flex-1 rounded border px-3 py-2 text-sm"
                    disabled={isPending}
                    {...form.register(`weekly.${key}`, {
                      setValueAs: (v: string) => normalizeTime(v),
                    })}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Deixa um dia em branco se não tens aulas nesse dia.
              </p>
            </div>
          )}
        </div>

        {/* Intervalos letivos */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Períodos letivos em que este horário é válido</p>
          <div className="space-y-3">
            {fields.map((field, index) => {
              const termErrors = form.formState.errors.terms?.[index];
              return (
                <div key={field.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <label
                        htmlFor={`term-start-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        Início
                      </label>
                      <input
                        id={`term-start-${index}`}
                        type="date"
                        className="w-full rounded border px-3 py-2 text-sm"
                        disabled={isPending}
                        {...form.register(`terms.${index}.startDate`)}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label
                        htmlFor={`term-end-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        Fim
                      </label>
                      <input
                        id={`term-end-${index}`}
                        type="date"
                        className="w-full rounded border px-3 py-2 text-sm"
                        disabled={isPending}
                        {...form.register(`terms.${index}.endDate`)}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover intervalo ${index + 1}`}
                      onClick={() => remove(index)}
                      disabled={isPending || fields.length <= 1}
                      className="mt-4 p-2 text-muted-foreground hover:text-signal-alert transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {(termErrors?.startDate || termErrors?.endDate || termErrors?.root) && (
                    <div className="text-xs text-destructive space-y-1">
                      {termErrors.startDate?.message && <p>{termErrors.startDate.message}</p>}
                      {termErrors.endDate?.message && <p>{termErrors.endDate.message}</p>}
                      {termErrors.root?.message && <p>{termErrors.root.message}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {typeof form.formState.errors.terms?.message === "string" && (
            <p className="text-xs text-destructive">{form.formState.errors.terms.message}</p>
          )}

          <button
            type="button"
            onClick={() => append(EMPTY_TERM)}
            disabled={isPending}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={16} />
            Adicionar intervalo
          </button>
        </div>

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={isPending} aria-busy={isPending}>
          {isPending ? "A guardar..." : "Guardar horário"}
        </Button>
      </form>
    </>
  );
}
