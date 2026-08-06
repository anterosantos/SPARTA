"use client";

import { useState, useTransition } from "react";
import { getCoachInviteLink } from "@/lib/actions/admin";

interface Props {
  profileId: string;
}

export function CopyCoachInviteLinkButton({ profileId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  function handleCopy() {
    startTransition(async () => {
      const result = await getCoachInviteLink(profileId);
      if (!result.ok || !result.data) {
        console.error("Failed to get invite link:", result.error?.message);
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
    <button
      type="button"
      onClick={handleCopy}
      disabled={isPending}
      className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
    >
      {isPending ? "A gerar…" : state === "copied" ? "Copiado!" : state === "error" ? "Erro" : "Copiar link"}
    </button>
  );
}
