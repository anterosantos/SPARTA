import type { Metadata } from "next";
import { ManualContent } from "./manual-content";
import { MANUAL_JOGADOR_MD } from "./content";

export const metadata: Metadata = {
  title: "Manual do Jogador",
};

export default function ManualJogadorPage() {
  return (
    <main id="main-content" className="max-w-prose mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Manual do Jogador</h1>
      <ManualContent content={MANUAL_JOGADOR_MD} />
    </main>
  );
}
