import { getStaffTeamsForPlayerCreation } from "@/lib/actions/players";
import { NovoJogadorForm } from "./NovoJogadorForm";

export const metadata = { title: "Novo Jogador — SPARTA" };

export default async function NovoJogadorPage() {
  const teams = await getStaffTeamsForPlayerCreation();
  return <NovoJogadorForm teams={teams} />;
}
