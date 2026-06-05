"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

export function NotificationsRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => { router.refresh(); })}
      disabled={isPending}
      aria-label="Atualizar notificações"
      className="ml-auto flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
}
