import Link from "next/link";
import { CalendarCheck, Users, Bell, X } from "lucide-react";
import type { PlayerNotificationItem } from "@/lib/actions/player-notifications";
import { dismissPlayerNotification } from "@/lib/actions/player-notifications";

interface PlayerNotificationsInboxProps {
  items: PlayerNotificationItem[];
}

const TZ = "Europe/Lisbon";

function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  // Comparar datas em Europe/Lisbon para evitar desvios UTC
  const toDateStr = (d: Date) =>
    d.toLocaleDateString("pt-PT", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

  const time = date.toLocaleTimeString("pt-PT", {
    hour: "2-digit", minute: "2-digit", timeZone: TZ, hour12: false,
  });

  const dateStr = toDateStr(date);
  const todayStr = toDateStr(now);
  const tomorrowStr = toDateStr(new Date(now.getTime() + 86_400_000));

  if (dateStr === todayStr) return `Hoje · ${time}`;
  if (dateStr === tomorrowStr) return `Amanhã · ${time}`;

  return date.toLocaleDateString("pt-PT", {
    weekday: "short", day: "numeric", month: "short", timeZone: TZ,
  }) + ` · ${time}`;
}

function ConvocadoCard({ item }: { item: PlayerNotificationItem }) {
  const dateLabel = item.sessionScheduledAt
    ? formatSessionDate(item.sessionScheduledAt)
    : null;

  const isMatch =
    item.sessionTypeLabel === "Jogo" ||
    item.sessionTypeLabel === "Jogo amigável";

  const accentColor = isMatch
    ? "border-l-red-500 dark:border-l-red-400"
    : "border-l-blue-500 dark:border-l-blue-400";

  // Bind server action para este item específico
  const dismissAction = item.sessionId
    ? dismissPlayerNotification.bind(null, item.sessionId, "convocado")
    : null;

  const cardBody = (
    <div
      className={`flex items-start gap-3 rounded-xl border border-border bg-card p-4 border-l-4 ${accentColor}`}
    >
      <div className="mt-0.5 shrink-0">
        <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-foreground">Convocado</p>
        <p className="text-sm text-foreground">
          {item.sessionTypeLabel}
          {item.opponentName ? ` vs ${item.opponentName}` : ""}
          {item.sessionLocation ? ` · ${item.sessionLocation}` : ""}
        </p>
        {dateLabel && (
          <p className="text-xs text-muted-foreground capitalize">{dateLabel}</p>
        )}
        {item.concentrationTime && (
          <p className="text-xs font-semibold text-foreground mt-1">
            Concentração: {item.concentrationTime}
          </p>
        )}
      </div>
      {item.sessionId && (
        <CalendarCheck
          className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"
          aria-hidden="true"
        />
      )}
    </div>
  );

  return (
    <div className="relative">
      {/* Card clicável → detalhe da sessão */}
      {item.sessionId ? (
        <Link
          href={`/agenda/${item.sessionId}`}
          className="block hover:opacity-80 transition-opacity"
          aria-label={`Convocado — ${item.sessionTypeLabel}${item.opponentName ? ` vs ${item.opponentName}` : ""} ${dateLabel ?? ""}`}
        >
          {cardBody}
        </Link>
      ) : (
        cardBody
      )}

      {/* Botão de dispensa — posicionado no canto superior direito */}
      {dismissAction && (
        <form action={dismissAction} className="absolute top-2 right-2">
          <button
            type="submit"
            className="flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Remover notificação"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  );
}

export function PlayerNotificationsInbox({
  items,
}: PlayerNotificationsInboxProps) {
  const convocatorias = items.filter((i) => i.kind === "convocado");
  const broadcasts = items.filter((i) => i.kind === "broadcast");

  const hasContent = convocatorias.length > 0 || broadcasts.length > 0;

  return (
    <section aria-labelledby="notifications-heading" className="space-y-3">
      <h2
        id="notifications-heading"
        className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        Notificações
      </h2>

      {!hasContent ? (
        <p className="text-sm text-muted-foreground px-1">
          Sem notificações de momento.
        </p>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {convocatorias.map((item) => (
            <li key={item.id}>
              <ConvocadoCard item={item} />
            </li>
          ))}

          {broadcasts.map((item) => (
            <li key={item.id}>
              <div className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-yellow-500 dark:border-l-yellow-400">
                <p className="text-sm font-semibold text-foreground">
                  Mensagem do staff
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {item.message}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
