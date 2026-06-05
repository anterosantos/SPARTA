import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getBroadcastsForClub } from "@/lib/actions/broadcasts";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { BroadcastForm } from "./broadcast-form";

export const metadata = { title: "Mensagens" };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days !== 1 ? "s" : ""}`;
}

export default async function MensagensPage() {
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

  const isCoach = profile.role === "coach";
  const broadcastsResult = await getBroadcastsForClub();
  const broadcasts = broadcastsResult.ok ? broadcastsResult.data : [];

  return (
    <main id="main-content" className="flex flex-col min-h-screen">
      <StickyHeader title="Mensagens" />

      <div className="flex-1 px-4 py-6 sm:px-6 space-y-6 max-w-2xl mx-auto w-full">
        {/* Formulário de envio — apenas treinadores */}
        {isCoach && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Nova mensagem
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <BroadcastForm />
            </div>
          </section>
        )}

        {/* Histórico de mensagens enviadas */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Enviadas (últimos 30 dias)
          </h2>

          {broadcasts.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">
              Nenhuma mensagem enviada ainda.
            </p>
          ) : (
            <ul className="space-y-2 list-none p-0 m-0">
              {broadcasts.map((b) => (
                <li key={b.id}>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <MessageSquare
                        className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-foreground flex-1">{b.message}</p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {relativeTime(b.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
