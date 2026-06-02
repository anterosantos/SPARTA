import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireStaffRole } from "@/lib/actions/auth";
import { RelatorioPdfForm } from "./RelatorioPdfForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Gerar Relatório — Jogador ${id}` };
}

export default async function NovoRelatorioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const auth = await requireStaffRole();
  if (!auth.ok) redirect("/login");

  return (
    <main className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href={`/plantel/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar ao jogador
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Gerar Relatório PDF</h1>
      </div>
      <RelatorioPdfForm playerId={id} />
    </main>
  );
}
