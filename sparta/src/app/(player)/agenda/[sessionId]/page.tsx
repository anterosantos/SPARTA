import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionById } from "@/lib/actions/sessions";
import { getPlayerAttendanceForSession } from "@/lib/actions/player-attendance";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { SESSION_TYPE_COLORS, sessionLabelWithOpponent } from "@/lib/constants/session-colors";
import { sessionEndDate } from "@/lib/session-time";
import { AbsenceForm } from "./absence-form";

export const metadata = { title: "Detalhe da sessão" };

export default async function PlayerSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "player") redirect("/hoje");

  const [sessionResult, attendanceResult] = await Promise.all([
    getSessionById(sessionId),
    getPlayerAttendanceForSession(sessionId),
  ]);

  if (!sessionResult.ok) redirect("/agenda");

  const session = sessionResult.data;
  const attendance = attendanceResult.ok ? attendanceResult.data : null;

  const config = SESSION_TYPE_COLORS[session.type] ?? SESSION_TYPE_COLORS.training;
  const TZ = "Europe/Lisbon";
  const date = new Date(session.scheduled_at);
  const formattedDate = date.toLocaleDateString("pt-PT", {
    weekday: "long", day: "numeric", month: "long", timeZone: TZ,
  });
  const formattedTime = date.toLocaleTimeString("pt-PT", {
    hour: "2-digit", minute: "2-digit", timeZone: TZ, hour12: false,
  });
  const formattedEndTime = sessionEndDate(session.scheduled_at, session.duration_min ?? 90).toLocaleTimeString(
    "pt-PT",
    { hour: "2-digit", minute: "2-digit", timeZone: TZ, hour12: false }
  );

  const STATUS_LABEL: Record<string, string> = {
    sem_questionario: "Sem questionário",
    present: "Presente",
    absent: "Ausente",
    late: "Atrasado",
    injured: "Lesionado",
    excused: "Justificado",
  };

  return (
    <main id="main-content">
      <StickyHeader title="Sessão" backHref="/agenda" />

      <div className="px-4 py-6 space-y-6">
        {/* Session card */}
        <div
          className="rounded-xl p-5 text-white space-y-3"
          style={{ backgroundColor: config.bg }}
        >
          <p className="text-lg font-bold">{sessionLabelWithOpponent(config.label, session)}</p>
          <div className="space-y-1 text-sm opacity-90">
            <p className="capitalize">{formattedDate}</p>
            <p>{formattedTime} - {formattedEndTime}</p>
            {session.location && <p>{session.location}</p>}
          </div>
        </div>

        {/* Notas da sessão (se existirem) */}
        {session.notes && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Notas
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{session.notes}</p>
          </div>
        )}

        {/* Current status (if any) */}
        {attendance && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              O teu estado atual
            </p>
            <p className="text-sm font-semibold text-foreground">
              {STATUS_LABEL[attendance.status] ?? attendance.status}
            </p>
            {attendance.note && (
              <p className="text-sm text-muted-foreground">&ldquo;{attendance.note}&rdquo;</p>
            )}
          </div>
        )}

        {/* Absence declaration */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Presença</h2>
          <AbsenceForm
            sessionId={sessionId}
            initialStatus={attendance?.status ?? null}
            initialNote={attendance?.note ?? null}
          />
        </div>
      </div>
    </main>
  );
}
