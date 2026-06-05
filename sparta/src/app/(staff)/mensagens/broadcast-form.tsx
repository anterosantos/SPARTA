"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendBroadcast } from "@/lib/actions/broadcasts";

const MAX_LENGTH = 500;

export function BroadcastForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setFeedback(null);

    startTransition(async () => {
      const result = await sendBroadcast({ message: message.trim() });
      if (result.ok) {
        setMessage("");
        setFeedback({ ok: true, text: "Mensagem enviada aos jogadores." });
        router.refresh();
      } else {
        setFeedback({ ok: false, text: result.error.message });
      }
    });
  }

  const remaining = MAX_LENGTH - message.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setFeedback(null);
        }}
        placeholder="Escreve a mensagem para os jogadores…"
        maxLength={MAX_LENGTH}
        rows={4}
        disabled={isPending}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs ${remaining < 50 ? "text-destructive font-medium" : "text-muted-foreground"}`}
        >
          {remaining} caracteres restantes
        </span>
        <Button
          type="submit"
          variant="primary"
          disabled={!message.trim() || isPending}
          className="flex items-center gap-2"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {isPending ? "A enviar…" : "Enviar"}
        </Button>
      </div>
      {feedback && (
        <p
          className={`text-sm ${feedback.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
        >
          {feedback.text}
        </p>
      )}
    </form>
  );
}
