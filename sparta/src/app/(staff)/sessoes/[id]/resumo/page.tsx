import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getMatchSummary } from "@/lib/actions/match-summary";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { sessionLabelWithOpponent } from "@/lib/constants/session-colors";

export const metadata = { title: "Resumo do jogo" };

const TZ = "Europe/Lisbon";

const ROLE_LABEL: Record<string, string> = {
  starter: "Titular",
  bench: "Suplente (entrou)",
  convocado_only: "Convocado (não entrou)",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchSummaryPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["coach", "analyst"].includes(profile.role ?? "")) {
    redirect("/");
  }

  const result = await getMatchSummary(id);
  if (!result.ok) {
    if (result.error.code === "not_found") redirect("/sessoes");
    throw new Error(result.error.message);
  }

  const { session, score, goals, cards, players, actionTotals } = result.data;

  const date = new Date(session.scheduledAt);
  const dateLabel = date.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
  const label = sessionLabelWithOpponent(
    session.type === "friendly" ? "Jogo amigável" : "Jogo",
    { type: session.type as "match" | "friendly", opponent_name: session.opponentName }
  );

  const startersUsed = players.filter((p) => p.minutesPlayed > 0);
  const neverEntered = players.filter((p) => p.minutesPlayed === 0);

  return (
    <div className="flex flex-col min-h-screen">
      <StickyHeader title="Resumo do jogo" backHref={`/sessoes/${id}`} />
      <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-2xl mx-auto w-full">
        <div>
          <h2 className="text-lg font-semibold text-foreground capitalize">{label}</h2>
          <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
          {session.status !== "completed" && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Jogo ainda não encerrado — estas estatísticas podem mudar.
            </p>
          )}
        </div>

        {/* Placar */}
        <section className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Placar
          </p>
          <p className="text-3xl font-bold text-foreground">
            {score.own} — {score.opponent}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Nós vs Adversário</p>
        </section>

        {/* Estatísticas da equipa — agregado de todos os eventos capturados na
            captura de eventos, somados para toda a equipa (não por jogador). */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Estatísticas da equipa
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {actionTotals.map((stat) => (
              <div
                key={stat.action}
                className={`rounded-lg border p-3 text-center ${
                  stat.positive
                    ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20"
                }`}
              >
                <p className="text-xl font-bold text-foreground tabular-nums">
                  {stat.count}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Golos */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Golos ({goals.length})
          </h3>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem golos registados.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {goals.map((g, i) => (
                <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">
                    {g.team === "opponent" ? (
                      <span className="text-muted-foreground">Adversário</span>
                    ) : (
                      <>
                        {g.jerseyNum != null && (
                          <span className="tabular-nums text-muted-foreground mr-2">
                            {g.jerseyNum}
                          </span>
                        )}
                        {g.playerName ?? "—"}
                      </>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {g.minute != null ? `${g.minute}'` : `${g.period}ª parte`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Cartões */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Cartões ({cards.length})
          </h3>
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem cartões registados.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {cards.map((c, i) => (
                <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span
                      className={`inline-block h-3.5 w-2.5 rounded-sm ${
                        c.cardType === "red" ? "bg-red-600" : "bg-yellow-400"
                      }`}
                      aria-hidden="true"
                    />
                    {c.jerseyNum != null && (
                      <span className="tabular-nums text-muted-foreground">{c.jerseyNum}</span>
                    )}
                    {c.playerName ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">{c.period}ª parte</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Jogadores utilizados */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Jogadores utilizados ({startersUsed.length})
          </h3>
          {startersUsed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem minutos registados ainda.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {startersUsed.map((p) => (
                <li key={p.playerId} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">
                    {p.jerseyNum != null && (
                      <span className="tabular-nums text-muted-foreground mr-2">
                        {p.jerseyNum}
                      </span>
                    )}
                    {p.fullName}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {p.minutesPlayed} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Convocados que não entraram */}
        {neverEntered.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Não entraram ({neverEntered.length})
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {neverEntered.map((p) => (
                <li key={p.playerId} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">
                    {p.jerseyNum != null && (
                      <span className="tabular-nums text-muted-foreground mr-2">
                        {p.jerseyNum}
                      </span>
                    )}
                    {p.fullName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABEL[p.role] ?? p.role}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
