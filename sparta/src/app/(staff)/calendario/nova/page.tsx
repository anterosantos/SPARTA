import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { getStaffTeamsForPlayerCreation } from "@/lib/actions/players";
import { SessionForm } from "@/app/(staff)/calendario/session-form";
import { buildCalendarViewQuery } from "@/lib/utils/calendar-query";

export const metadata = { title: "Nova sessão" };

export default async function NovaSessionPage({
  searchParams,
}: {
  searchParams?: Promise<{ cumulativo?: string; vista?: string; mes?: string }>;
}) {
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

  if (!profile || profile.role !== "coach") {
    redirect("/calendario");
  }

  const [seasonResult, staffTeams] = await Promise.all([
    getCurrentSeason(),
    getStaffTeamsForPlayerCreation(),
  ]);

  const hasSeason = seasonResult.ok && seasonResult.data !== null;

  // Preserve the calendar view (vista/cumulativo/mes) the coach came from,
  // so submitting/closing this form returns to the same view.
  const params = await searchParams;
  const returnTo = `/calendario${buildCalendarViewQuery(params ?? {})}`;

  return (
    <main id="main-content">
      <div className="px-4 py-6 sm:px-6">
        <SessionForm
          mode="create"
          hasSeason={hasSeason}
          staffTeams={staffTeams}
          returnTo={returnTo}
        />
      </div>
    </main>
  );
}
