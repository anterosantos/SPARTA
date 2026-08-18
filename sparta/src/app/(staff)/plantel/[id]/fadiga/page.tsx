import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { FatigueTabs } from "@/components/domain/FatigueTabs";
import { getPlayerFatigueData } from "@/lib/actions/fatigue-staff";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Fadiga — Jogador ${id}` };
}

/**
 * /plantel/[id]/fadiga — Staff-only page showing 28-day fatigue data for a player.
 *
 * AC #1: Role validation (coach/analyst) + club_id match via getPlayerFatigueData()
 * AC #2: auditedRead() inside action — fire-and-forget audit_logs entry
 * AC #5: Tabs "Gráfico" / "Tabela" rendered by FatigueTabs client component
 * AC #7: Empty state handled inside FatigueChart / FatigueTable
 * AC #8: aria-label on panels, tablist, keyboard-accessible tabs
 */
export default async function PlayerFadigaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const result = await getPlayerFatigueData(id);

  if (!result.ok) {
    // 404 apenas para not_found/unauthorized (AC #1 — não revelar existência do recurso).
    // Erros genuínos (ex: internal) mostram-se como erro real — um 404 genérico aqui
    // escondia falhas reais de todos os jogadores atrás de uma mensagem enganosa.
    if (result.error.code === "not_found" || result.error.code === "unauthorized") {
      notFound();
    }
    logger.error("plantel_fadiga.load_failed", {
      player_id: id,
      code: result.error.code,
      message: result.error.message,
    });
    return (
      <>
        <StickyHeader title="Erro" backHref={`/plantel/${id}`} />
        <main id="main-content">
          <div className="px-4 py-6 sm:px-6">
            <p className="text-red-600 font-mono text-sm">
              {result.error.message ?? "Erro ao carregar dados de fadiga."}
            </p>
          </div>
        </main>
      </>
    );
  }

  const { responses, sessions, playerName, playerId } = result.data;

  return (
    <div className="px-4 py-6 sm:px-6 max-w-3xl mx-auto">
      {/* Back navigation */}
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/plantel/${id}`}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {playerName}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Fadiga</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Últimos 28 dias · {responses.length === 0 ? "sem respostas" : `${responses.length} respostas`}
        </p>
      </div>

      {/* Tabs + Chart/Table + Filters (client component) */}
      <FatigueTabs
        playerId={playerId}
        playerName={playerName}
        responses={responses}
        sessions={sessions}
      />
    </div>
  );
}
