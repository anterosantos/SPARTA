import { notFound, redirect } from "next/navigation";
import { Dumbbell, Trophy, Handshake, Presentation } from "lucide-react";
import { SessionDateDisplay } from "./session-date-display";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionById } from "@/lib/actions/sessions";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { SessionDetailActions } from "./session-detail-actions";
import { sessionLabelWithOpponent } from "@/lib/constants/session-colors";
import type { SessionType, SessionStatus } from "@/lib/schemas/sessions";

export const metadata = { title: "Detalhes da sessão" };

const TYPE_CONFIG: Record<
  SessionType,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  training: { label: "Treino", Icon: Dumbbell },
  match: { label: "Jogo", Icon: Trophy },
  friendly: { label: "Jogo amigável", Icon: Handshake },
  lecture: { label: "Palestra", Icon: Presentation },
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: "Agendada",
  cancelled: "Cancelada",
  completed: "Concluída",
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["coach", "analyst"].includes(profile.role ?? "")) {
    redirect("/");
  }

  const result = await getSessionById(id);
  if (!result.ok) {
    if (result.error.code === "not_found") notFound();
    throw new Error(result.error.message);
  }

  const session = result.data;
  const config = TYPE_CONFIG[session.type as SessionType] ?? TYPE_CONFIG.training;
  const Icon = config.Icon;
  const label = sessionLabelWithOpponent(config.label, session);
  const statusLabel = STATUS_LABELS[session.status as SessionStatus] ?? session.status;
  const isScheduled = session.status === "scheduled";
  const isCoach = profile.role === "coach";

  return (
    <main id="main-content">
      <StickyHeader title="Detalhes da sessão" backHref="/calendario" />
      <div className="px-4 py-6 sm:px-6 space-y-4">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-foreground" />
          <h1 className="text-lg font-semibold">{label}</h1>
        </div>

        <dl className="space-y-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Data e hora
            </dt>
            {/* suppressHydrationWarning: server renders UTC, client renders local timezone */}
            <dd className="mt-0.5 text-sm capitalize" suppressHydrationWarning>
              <SessionDateDisplay isoString={session.scheduled_at} />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Duração
            </dt>
            <dd className="mt-0.5 text-sm">{session.duration_min} minutos</dd>
          </div>

          {session.location && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Local
              </dt>
              <dd className="mt-0.5 text-sm">{session.location}</dd>
            </div>
          )}

          {session.notes && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notas
              </dt>
              <dd className="mt-0.5 text-sm whitespace-pre-wrap">{session.notes}</dd>
            </div>
          )}

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estado
            </dt>
            <dd className="mt-0.5">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  session.status === "cancelled"
                    ? "bg-muted text-muted-foreground"
                    : session.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                }`}
              >
                {statusLabel}
              </span>
            </dd>
          </div>
        </dl>

        <SessionDetailActions
          sessionId={session.id}
          sessionType={session.type}
          isScheduled={isScheduled}
          isCoach={isCoach}
        />
      </div>
    </main>
  );
}
