"use client"

import Link from "next/link"
import { format } from "date-fns"
import { pt } from "date-fns/locale"
import type { Session } from "@/lib/schemas/sessions"
import { SESSION_TYPE_COLORS, sessionLabelWithOpponent } from "@/lib/constants/session-colors"
import { sessionEndDate } from "@/lib/session-time"
import { useDarkMode } from "@/hooks/useDarkMode"

interface SessionBlockProps {
  session: Session
  sessionBasePath?: string
}

export function SessionBlock({ session, sessionBasePath = "/sessoes" }: SessionBlockProps) {
  const isDark = useDarkMode()
  const config = SESSION_TYPE_COLORS[session.type]
  const bgColor = isDark ? config.bgDark : config.bg
  const isCancelled = session.status === "cancelled"
  const time = format(new Date(session.scheduled_at), "HH:mm", { locale: pt })
  const endTime = format(sessionEndDate(session.scheduled_at, session.duration_min), "HH:mm", { locale: pt })
  const timeRange = `${time} - ${endTime}`
  const label = sessionLabelWithOpponent(config.label, session)

  return (
    <Link
      href={`${sessionBasePath}/${session.id}`}
      aria-label={`${label}, ${timeRange}${session.location ? `, ${session.location}` : ", sem local"}`}
      className="block w-full rounded-lg p-4 text-white transition-opacity hover:opacity-90"
      style={{ backgroundColor: bgColor, opacity: isCancelled ? 0.5 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold leading-tight">
            {label}
            {isCancelled && (
              <span className="ml-2 text-xs font-normal opacity-90">Cancelada</span>
            )}
          </p>
          <p className="text-xs opacity-90">
            {timeRange}
          </p>
          {session.location && (
            <p className="text-xs opacity-80">{session.location}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
