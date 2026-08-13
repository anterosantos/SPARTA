import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { getSessionFatigueStatus } from "@/lib/actions/fatigue";
import { getPlayerAttendanceForSession } from "@/lib/actions/player-attendance";
import { getPlayerNotifications } from "@/lib/actions/player-notifications";
import { requiresFatigueQuestionnaire } from "@/lib/schemas/sessions";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { TodayPageContent } from "@/components/app/today-page-content";

export const metadata = { title: "Hoje" };

export default async function HojePage() {
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

  if (!profile || profile.role !== "player") {
    redirect("/");
  }

  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Sessões dos próximos 7 dias (todas — não só a mais próxima) + sessão recente (post)
  const [result, recentResult] = await Promise.all([
    getSessionsForClub({
      from: now.toISOString(),
      to: sevenDaysLater.toISOString(),
      status: "scheduled",
    }),
    getSessionsForClub({
      from: twentyFourHoursAgo.toISOString(),
      to: now.toISOString(),
      // Sem filtro de status — aceitar 'scheduled' e 'completed'
    }),
  ]);

  const upcomingSessions = result.ok ? (result.data ?? []) : [];

  let recentSession = null;
  if (recentResult.ok && (recentResult.data ?? []).length > 0) {
    // Filtrar para excluir 'cancelled', palestras (sem questionário de fadiga) e
    // sessões com scheduled_at >= now (limite estrito < now).
    // Nota: getSessionsForClub usa lte no limite superior — excluir a fronteira exacta para
    // evitar que uma sessão apareça simultaneamente em "Próximos 7 dias" e "Sessão recente".
    const nowMs = now.getTime();
    const recentSessions = (recentResult.data ?? []).filter(
      (s) =>
        s.status !== "cancelled" &&
        requiresFatigueQuestionnaire(s.type) &&
        new Date(s.scheduled_at).getTime() < nowMs
    );
    // Pegar a mais recente (query ordenada ascending — último elemento = mais recente)
    if (recentSessions.length > 0) {
      recentSession = recentSessions[recentSessions.length - 1] ?? null;
    }
  }

  // Estado do questionário pré-sessão para cada sessão futura que o exige
  // (palestras ficam de fora — não têm questionário de fadiga)
  const fatigueEligibleSessions = upcomingSessions.filter((s) =>
    requiresFatigueQuestionnaire(s.type)
  );

  const [fatigueResults, recentFatigueStatus, recentAttendance, notificationsResult] = await Promise.all([
    Promise.all(fatigueEligibleSessions.map((s) => getSessionFatigueStatus(s.id))),
    recentSession ? getSessionFatigueStatus(recentSession.id) : Promise.resolve(null),
    recentSession ? getPlayerAttendanceForSession(recentSession.id) : Promise.resolve(null),
    getPlayerNotifications(),
  ]);

  const answeredMap: Record<string, boolean> = {};
  fatigueEligibleSessions.forEach((s, i) => {
    const fatigueResult = fatigueResults[i];
    answeredMap[s.id] = fatigueResult?.ok ? fatigueResult.data.pre : false;
  });

  const notifications = notificationsResult.ok ? notificationsResult.data : [];

  const recentPostAnswered = recentFatigueStatus?.ok ? recentFatigueStatus.data.post : false;
  const recentPreAnswered = recentFatigueStatus?.ok ? recentFatigueStatus.data.pre : false;
  const recentIsAbsent = recentAttendance?.ok && recentAttendance.data?.status === "absent";

  // "Tudo em dia" se houver sessão recente com AMBAS as fases respondidas, ou se o
  // jogador declarou ausência (questionário pós-sessão fica indisponível nesse caso)
  const allDoneToday =
    recentSession !== null && (recentIsAbsent || (recentPreAnswered && recentPostAnswered));

  // Secção recente visível apenas se post por responder e o jogador não declarou ausência
  const showRecentSession = recentSession !== null && !recentPostAnswered && !recentIsAbsent;

  return (
    <>
      <StickyHeader title="Hoje" />
      <main id="main-content">
        <TodayPageContent
          upcomingSessions={upcomingSessions}
          answeredMap={answeredMap}
          recentSession={showRecentSession ? recentSession : null}
          allDoneToday={allDoneToday}
          userRole={profile.role}
          notifications={notifications}
        />
      </main>
    </>
  );
}
