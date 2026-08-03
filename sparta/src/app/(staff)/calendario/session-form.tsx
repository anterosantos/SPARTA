"use client";

import { useTransition, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { createSession, updateSession, getSessionTeams, updateSessionTeams } from "@/lib/actions/sessions";
import type { StaffTeam } from "@/lib/actions/players";
import {
  SessionCreateSchema,
  SessionUpdateSchema,
  type Session,
} from "@/lib/schemas/sessions";

// Use z.input<> to match zodResolver's expected input types (handles .default())
type SessionCreateInput = z.input<typeof SessionCreateSchema>;
type SessionUpdateInput = z.input<typeof SessionUpdateSchema>;

const SESSION_TYPE_LABELS: Record<string, string> = {
  training: "Treino",
  match: "Jogo",
  friendly: "Jogo amigável",
  lecture: "Palestra",
};

// Convert ISO datetime string to local datetime-local input format
function toDateTimeLocal(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert datetime-local input value to ISO string.
// `new Date("YYYY-MM-DDTHH:mm")` (no timezone designator) is already parsed as
// local time per spec, so no further offset adjustment is needed here — applying
// getTimezoneOffset() on top double-shifted the result whenever the browser's
// offset was non-zero (e.g. off by 1h during Lisbon's summer DST).
function toISOFromLocal(localStr: string): string {
  return new Date(localStr).toISOString();
}

// ─── Create Form ──────────────────────────────────────────────────────────────

interface SessionFormCreateProps {
  mode: "create";
  hasSeason: boolean;
  staffTeams?: StaffTeam[];
}

function SessionCreateForm({ hasSeason, staffTeams = [] }: SessionFormCreateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(
    staffTeams.length === 1 && staffTeams[0] ? new Set([staffTeams[0].id]) : new Set()
  );

  const form = useForm<SessionCreateInput>({
    resolver: zodResolver(SessionCreateSchema),
    defaultValues: {
      type: "training",
      scheduledAt: "",
      durationMin: 90,
      location: "",
      notes: "",
    },
  });

  const watchedType = form.watch("type");
  const isSingleTeamType = watchedType === "match" || watchedType === "friendly";

  function toggleTeam(id: string) {
    setSelectedTeamIds((prev) => {
      if (isSingleTeamType) {
        return prev.has(id) ? new Set() : new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setOpen(false);
    router.push("/calendario");
  }

  function onSubmit(data: SessionCreateInput) {
    if (staffTeams.length > 0 && selectedTeamIds.size === 0) {
      form.setError("root", { message: "Seleciona pelo menos uma equipa." });
      return;
    }
    startTransition(async () => {
      try {
        const teamIds = [...selectedTeamIds];
        const result = await createSession(
          {
            type: data.type,
            scheduledAt: data.scheduledAt ? toISOFromLocal(data.scheduledAt) : "",
            durationMin: data.durationMin ?? 90,
            location: data.location || undefined,
            notes: data.notes || undefined,
          },
          teamIds.length > 0 ? teamIds : undefined
        );
        if (!result.ok) {
          form.setError("root", { message: result.error.message });
          return;
        }
        setShowConfirmation(true);
      } catch {
        form.setError("root", { message: "Erro ao comunicar com servidor" });
      }
    });
  }

  return (
    <>
      {showConfirmation && (
        <CalmConfirmation
          message="Sessão criada"
          onDismiss={() => router.push("/calendario")}
        />
      )}
      <DrillDownSheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <h2 className="text-base font-semibold mb-4">Nova sessão</h2>

        {!hasSeason && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Sem época actual definida. Configure em{" "}
            <a href="/configuracoes/epocas" className="underline font-medium">
              /configuracoes/epocas
            </a>
            .
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="session-type" className="text-sm font-medium">
              Tipo de sessão <span aria-hidden>*</span>
            </label>
            <select
              id="session-type"
              className="w-full rounded border px-3 py-2 text-sm bg-background"
              disabled={!hasSeason}
              {...form.register("type")}
            >
              {Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {form.formState.errors.type && (
              <p className="text-xs text-destructive">
                {form.formState.errors.type.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-scheduled-at" className="text-sm font-medium">
              Data e hora <span aria-hidden>*</span>
            </label>
            <input
              id="session-scheduled-at"
              type="datetime-local"
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={!hasSeason}
              {...form.register("scheduledAt")}
            />
            {form.formState.errors.scheduledAt && (
              <p className="text-xs text-destructive">
                {form.formState.errors.scheduledAt.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-duration" className="text-sm font-medium">
              Duração (minutos) <span aria-hidden>*</span>
            </label>
            <input
              id="session-duration"
              type="number"
              min={15}
              max={240}
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={!hasSeason}
              {...form.register("durationMin", { valueAsNumber: true })}
            />
            {form.formState.errors.durationMin && (
              <p className="text-xs text-destructive">
                {form.formState.errors.durationMin.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-location" className="text-sm font-medium">
              Local
            </label>
            <input
              id="session-location"
              type="text"
              maxLength={100}
              placeholder="ex: Campo Municipal"
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={!hasSeason}
              {...form.register("location")}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="session-notes" className="text-sm font-medium">
              Notas
            </label>
            <textarea
              id="session-notes"
              maxLength={500}
              rows={3}
              placeholder="Observações adicionais..."
              className="w-full rounded border px-3 py-2 text-sm resize-none"
              disabled={!hasSeason}
              {...form.register("notes")}
            />
          </div>

          {/* Equipas — obrigatório se staff tiver equipas atribuídas */}
          {staffTeams.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Equipa(s) <span aria-hidden>*</span>
                {isSingleTeamType && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(máx. 1 para jogo/amigável)</span>
                )}
              </p>
              <div className="space-y-2">
                {staffTeams.map((team) => (
                  <label key={team.id} className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type={isSingleTeamType ? "radio" : "checkbox"}
                      name={isSingleTeamType ? "session-team" : undefined}
                      checked={selectedTeamIds.has(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      disabled={isPending || !hasSeason}
                      className="h-4 w-4 border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm">
                      {team.name}
                      <span className="text-xs text-muted-foreground ml-1">— {team.rosterName}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.formState.errors.root && (
            <p className="text-xs text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={isPending || !hasSeason}
            >
              {isPending ? "A guardar…" : "Criar sessão"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </DrillDownSheet>
    </>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface SessionFormEditProps {
  mode: "edit";
  session: Session;
  staffTeams?: StaffTeam[];
}

function SessionEditForm({ session, staffTeams = [] }: SessionFormEditProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [loadingTeams, setLoadingTeams] = useState(true);

  const isLocked =
    session.status === "cancelled" || session.status === "completed";

  // Load assigned teams on mount
  useEffect(() => {
    (async () => {
      const result = await getSessionTeams(session.id);
      if (result.ok) {
        setSelectedTeamIds(new Set(result.data));
      }
      setLoadingTeams(false);
    })();
  }, [session.id]);

  const form = useForm<SessionUpdateInput>({
    resolver: zodResolver(SessionUpdateSchema),
    defaultValues: {
      id: session.id,
      type: session.type as SessionUpdateInput["type"],
      scheduledAt: toDateTimeLocal(session.scheduled_at),
      durationMin: session.duration_min,
      location: session.location ?? "",
      notes: session.notes ?? "",
    },
  });

  const watchedType = form.watch("type");
  const isSingleTeamType = watchedType === "match" || watchedType === "friendly";

  function toggleTeam(id: string) {
    setSelectedTeamIds((prev) => {
      if (isSingleTeamType) {
        return prev.has(id) ? new Set() : new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setOpen(false);
    router.push("/calendario");
  }

  function onSubmit(data: SessionUpdateInput) {
    startTransition(async () => {
      try {
        // Update session basic info
        const result = await updateSession({
          id: data.id,
          type: data.type,
          scheduledAt: data.scheduledAt ? toISOFromLocal(data.scheduledAt) : "",
          durationMin: data.durationMin ?? 90,
          location: data.location || undefined,
          notes: data.notes || undefined,
        });
        if (!result.ok) {
          form.setError("root", { message: result.error.message });
          return;
        }

        // Update teams
        const teamIds = [...selectedTeamIds];
        const teamsResult = await updateSessionTeams(
          data.id,
          teamIds.length > 0 ? teamIds : undefined
        );
        if (!teamsResult.ok) {
          form.setError("root", { message: teamsResult.error.message });
          return;
        }

        setShowConfirmation(true);
      } catch {
        form.setError("root", { message: "Erro ao comunicar com servidor" });
      }
    });
  }

  return (
    <>
      {showConfirmation && (
        <CalmConfirmation
          message="Sessão actualizada"
          onDismiss={() => router.push("/calendario")}
        />
      )}
      <DrillDownSheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <h2 className="text-base font-semibold mb-4">Editar sessão</h2>

        {isLocked && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Esta sessão não pode ser editada (cancelada/concluída)
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="session-type" className="text-sm font-medium">
              Tipo de sessão <span aria-hidden>*</span>
            </label>
            <select
              id="session-type"
              className="w-full rounded border px-3 py-2 text-sm bg-background"
              disabled={isLocked}
              {...form.register("type")}
            >
              {Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {form.formState.errors.type && (
              <p className="text-xs text-destructive">
                {form.formState.errors.type.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-scheduled-at" className="text-sm font-medium">
              Data e hora <span aria-hidden>*</span>
            </label>
            <input
              id="session-scheduled-at"
              type="datetime-local"
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={isLocked}
              {...form.register("scheduledAt")}
            />
            {form.formState.errors.scheduledAt && (
              <p className="text-xs text-destructive">
                {form.formState.errors.scheduledAt.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-duration" className="text-sm font-medium">
              Duração (minutos) <span aria-hidden>*</span>
            </label>
            <input
              id="session-duration"
              type="number"
              min={15}
              max={240}
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={isLocked}
              {...form.register("durationMin", { valueAsNumber: true })}
            />
            {form.formState.errors.durationMin && (
              <p className="text-xs text-destructive">
                {form.formState.errors.durationMin.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-location" className="text-sm font-medium">
              Local
            </label>
            <input
              id="session-location"
              type="text"
              maxLength={100}
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={isLocked}
              {...form.register("location")}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="session-notes" className="text-sm font-medium">
              Notas
            </label>
            <textarea
              id="session-notes"
              maxLength={500}
              rows={3}
              className="w-full rounded border px-3 py-2 text-sm resize-none"
              disabled={isLocked}
              {...form.register("notes")}
            />
          </div>

          {/* Equipas — se staff tiver equipas */}
          {staffTeams.length > 0 && !loadingTeams && (
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Equipa(s)
                {isSingleTeamType && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(máx. 1 para jogo/amigável)</span>
                )}
              </p>
              <div className="space-y-2">
                {staffTeams.map((team) => (
                  <label key={team.id} className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type={isSingleTeamType ? "radio" : "checkbox"}
                      name={isSingleTeamType ? "session-team" : undefined}
                      checked={selectedTeamIds.has(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      disabled={isPending || isLocked}
                      className="h-4 w-4 border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm">
                      {team.name}
                      <span className="text-xs text-muted-foreground ml-1">— {team.rosterName}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.formState.errors.root && (
            <p className="text-xs text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            {!isLocked && (
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "A guardar…" : "Actualizar sessão"}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={handleClose}>
              {isLocked ? "Fechar" : "Cancelar"}
            </Button>
          </div>
        </form>
      </DrillDownSheet>
    </>
  );
}

// ─── Public Component ─────────────────────────────────────────────────────────

type Props = SessionFormCreateProps | SessionFormEditProps;

export function SessionForm(props: Props) {
  if (props.mode === "edit") {
    return <SessionEditForm {...props} />;
  }
  return <SessionCreateForm {...props} />;
}
