import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarViewToggle } from "@/components/ui/calendar-view-toggle";
import { CalendarWeekView } from "@/components/ui/calendar-week-view";
import { CalendarMonthView } from "@/components/ui/calendar-month-view";
import {
  format,
  startOfDay,
  endOfDay,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { pt } from "date-fns/locale";
import type { Session } from "@/lib/schemas/sessions";

export const metadata = { title: "Agenda" };

export default async function PlayerAgendaPage({
  searchParams,
}: {
  searchParams?: Promise<{ vista?: string; mes?: string }>;
}) {
  const params = await searchParams;
  const vista = params?.vista === "semana" ? "semana" : "mes";

  const today = new Date();
  const targetMonth = (() => {
    const raw = params?.mes;
    if (raw && /^\d{4}-\d{2}$/.test(raw)) {
      const parsed = parseISO(`${raw}-01`);
      if (!isNaN(parsed.getTime())) return startOfMonth(parsed);
    }
    return startOfMonth(today);
  })();

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "player") redirect("/hoje");

  // Load sessions for the current season (read-only)
  const seasonResult = await getCurrentSeason();
  const seasonId = seasonResult.ok ? (seasonResult.data?.id ?? undefined) : undefined;

  const result = await getSessionsForClub(seasonId ? { season_id: seasonId } : undefined);
  if (!result.ok) throw new Error(`Erro ao carregar sessões: ${result.error.message}`);

  const sessions: Session[] = result.data;

  const next7End = addDays(today, 7);
  const next7Sessions = sessions
    .filter((s) => {
      const d = new Date(s.scheduled_at);
      return d >= startOfDay(today) && d <= endOfDay(next7End);
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const monthStart = targetMonth;
  const monthEnd = endOfMonth(targetMonth);
  const monthSessions = sessions.filter((s) => {
    const d = new Date(s.scheduled_at);
    return d >= monthStart && d <= monthEnd;
  });

  const monthLabel = format(targetMonth, "MMMM yyyy", { locale: pt });
  const prevMonthHref = `?vista=mes&mes=${format(subMonths(targetMonth, 1), "yyyy-MM")}`;
  const nextMonthHref = `?vista=mes&mes=${format(addMonths(targetMonth, 1), "yyyy-MM")}`;

  return (
    <main id="main-content">
      <StickyHeader title="Agenda" />
      <div className="px-4 py-6 sm:px-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CalendarViewToggle />
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
            title="Sem sessões agendadas"
            description="Ainda não há sessões marcadas para esta época."
          />
        ) : vista === "semana" ? (
          <CalendarWeekView allSessions={sessions} isCoach={false} sessionBasePath="/agenda" />
        ) : (
          <CalendarMonthView
            monthSessions={monthSessions}
            next7Sessions={next7Sessions}
            month={monthStart.toISOString()}
            monthLabel={monthLabel}
            prevMonthHref={prevMonthHref}
            nextMonthHref={nextMonthHref}
            sessionBasePath="/agenda"
          />
        )}
      </div>
    </main>
  );
}
