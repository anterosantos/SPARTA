import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStaffRole } from "@/lib/actions/auth";
import { getPlayerReports } from "@/lib/actions/reports";
import { RelatorioRow } from "./RelatorioRow";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Relatórios — Jogador ${id}` };
}

export default async function RelatoriosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const auth = await requireStaffRole();
  if (!auth.ok) redirect("/login");

  const result = await getPlayerReports(id);
  const reports = result.ok ? result.data : [];

  return (
    <main className="container mx-auto p-4 max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href={`/plantel/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar ao jogador
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Relatórios</h1>
          <Button asChild size="sm">
            <Link href={`/plantel/${id}/relatorio/novo`}>Gerar relatório</Link>
          </Button>
        </div>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8 text-muted-foreground" />}
          title="Sem relatórios"
          description="Ainda não foram gerados relatórios para este jogador."
        />
      ) : (
        <ul className="space-y-3" aria-label="Lista de relatórios">
          {reports.map((r) => (
            <li key={r.id}>
              <RelatorioRow report={r} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
