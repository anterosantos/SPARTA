import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { SchoolScheduleForm } from "./school-schedule-form";

export const metadata = {
  title: "Horário de Saída",
};

export default async function HorarioSaidaPage() {
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

  // Ecrã exclusivo do jogador (Ask First do spec: assumir visível só para role === 'player').
  if (profile?.role !== "player") {
    redirect("/configuracoes");
  }

  return (
    <main id="main-content">
      <StickyHeader title="Horário de Saída" backHref="/configuracoes" />
      <div className="px-4 py-6 sm:px-6">
        <Suspense
          fallback={
            <div className="py-8 text-center text-sm text-muted-foreground">A carregar...</div>
          }
        >
          <SchoolScheduleForm />
        </Suspense>
      </div>
    </main>
  );
}
