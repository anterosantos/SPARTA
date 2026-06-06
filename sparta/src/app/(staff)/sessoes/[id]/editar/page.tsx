import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionById } from "@/lib/actions/sessions";
import { getStaffTeamsForPlayerCreation } from "@/lib/actions/players";
import { SessionForm } from "@/app/(staff)/calendario/session-form";

export const metadata = { title: "Editar sessão" };

export default async function EditarSessionPage({
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

  if (!profile || profile.role !== "coach") {
    redirect("/calendario");
  }

  const [sessionResult, staffTeams] = await Promise.all([
    getSessionById(id),
    getStaffTeamsForPlayerCreation(),
  ]);

  if (!sessionResult.ok) {
    if (sessionResult.error.code === "not_found") notFound();
    throw new Error(sessionResult.error.message);
  }

  const session = sessionResult.data;

  return (
    <main id="main-content">
      <div className="px-4 py-6 sm:px-6">
        <SessionForm mode="edit" session={session} staffTeams={staffTeams} />
      </div>
    </main>
  );
}
