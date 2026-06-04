import Link from "next/link";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarCheck, Users, Bell } from "lucide-react";
import type { PlayerNotificationItem } from "@/lib/actions/player-notifications";

interface PlayerNotificationsInboxProps {
  items: PlayerNotificationItem[];
}

function formatSessionDate(iso: string): string {
  const date = parseISO(iso);
  const time = format(date, "HH:mm", { locale: pt });
  if (isToday(date)) return `Hoje · ${time}`;
  if (isTomorrow(date)) return `Amanhã · ${time}`;
  return format(date, "EEE d MMM · HH:mm", { locale: pt });
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

  const content = (
    <div
      className={`flex items-start gap-3 rounded-xl border border-border bg-card p-4 border-l-4 ${accentColor}`}
    >
      <div className="mt-0.5 shrink-0">
        <Users
          className="h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-foreground">Convocado</p>
        <p className="text-sm text-foreground">
          {item.sessionTypeLabel}
          {item.sessionLocation ? ` · ${item.sessionLocation}` : ""}
        </p>
        {dateLabel && (
          <p className="text-xs text-muted-foreground capitalize">{dateLabel}</p>
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

  if (item.sessionId) {
    return (
      <Link
        href={`/agenda/${item.sessionId}`}
        className="block hover:opacity-80 transition-opacity"
        aria-label={`Convocado — ${item.sessionTypeLabel} ${dateLabel ?? ""}`}
      >
        {content}
      </Link>
    );
  }

  return content;
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
          {/* Convocatórias */}
          {convocatorias.map((item) => (
            <li key={item.id}>
              <ConvocadoCard item={item} />
            </li>
          ))}

          {/* Broadcasts (futuro) */}
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
