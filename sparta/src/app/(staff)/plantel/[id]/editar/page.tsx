import { notFound } from "next/navigation";
import dynamicImport from "next/dynamic";
import { getPlayer, getStaffTeamsForPlayerCreation } from "@/lib/actions/players";

const EditPlayerForm = dynamicImport(() =>
  import("./edit-player-form").then(m => ({ default: m.EditPlayerForm })),
  { loading: () => <div className="p-4">Carregando...</div> }
);

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Editar Jogador" };
}

export default async function EditarJogadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [playerResult, staffTeams] = await Promise.all([
    getPlayer(id),
    getStaffTeamsForPlayerCreation(),
  ]);

  if (!playerResult.ok) notFound();

  return <EditPlayerForm player={playerResult.data} staffTeams={staffTeams} />;
}
