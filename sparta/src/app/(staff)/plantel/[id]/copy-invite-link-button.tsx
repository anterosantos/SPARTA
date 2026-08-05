"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getPlayerInviteLink } from "@/lib/actions/players";

interface CopyInviteLinkButtonProps {
  playerId: string;
}

export function CopyInviteLinkButton({ playerId }: CopyInviteLinkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  function handleCopy() {
    startTransition(async () => {
      const result = await getPlayerInviteLink({ playerId });
      if (!result.ok) {
        console.error("Failed to get invite link:", result.error.message);
        setState("error");
        setTimeout(() => setState("idle"), 2000);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.data.link);
        setState("copied");
      } catch (e) {
        console.error("Failed to copy invite link to clipboard:", e);
        setState("error");
      }
      setTimeout(() => setState("idle"), 2000);
    });
  }

  return (
    <Button size="sm" variant="ghost" onClick={handleCopy} disabled={isPending}>
      {isPending
        ? "A gerar…"
        : state === "copied"
          ? "Copiado!"
          : state === "error"
            ? "Erro ao copiar"
            : "Copiar link"}
    </Button>
  );
}
