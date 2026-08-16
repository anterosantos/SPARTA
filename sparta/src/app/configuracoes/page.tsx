import Link from "next/link";
import { BellIcon, BookOpenIcon, ChevronRightIcon, ClockIcon, ShieldCheckIcon } from "lucide-react";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Configurações",
};

export default async function ConfiguracoesPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  return (
    <main id="main-content">
      <StickyHeader title="Configurações" />
      <div className="px-4 py-6 sm:px-6">
        <ul className="space-y-2">
          <li>
            <Link
              href="/configuracoes/notificacoes"
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <BellIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Notificações</span>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
          {role === "player" && (
            <li>
              <Link
                href="/configuracoes/horario-saida"
                className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ClockIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Horário de Saída</span>
                </div>
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          )}
          <li>
            <Link
              href="/configuracoes/direitos"
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheckIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Os meus direitos</span>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
          <li>
            <Link
              href="/manual-jogador"
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <BookOpenIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Manual do jogador</span>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
