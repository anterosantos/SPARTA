"use client"

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  startOfDay,
  format,
} from "date-fns"
import { pt } from "date-fns/locale"
import { Cake } from "lucide-react"
import type { Session } from "@/lib/schemas/sessions"
import { SESSION_TYPE_COLORS } from "@/lib/constants/session-colors"
import type { BirthdayEntry } from "@/components/ui/calendar-month-view"

const DAY_HEADERS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]

interface MonthGridProps {
  sessions: Session[]
  month: Date
  onSelectDay: (date: Date) => void
  birthdays?: BirthdayEntry[]
}

function buildCalendarDays(month: Date): Date[] {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days: Date[] = []
  let current = calStart
  while (current <= calEnd) {
    days.push(current)
    current = addDays(current, 1)
  }
  return days
}

export function MonthGrid({ sessions, month, onSelectDay, birthdays = [] }: MonthGridProps) {
  const days = buildCalendarDays(month)

  const sessionsByDay = new Map<string, Session[]>()
  for (const session of sessions) {
    const key = startOfDay(new Date(session.scheduled_at)).toISOString()
    const existing = sessionsByDay.get(key) ?? []
    existing.push(session)
    sessionsByDay.set(key, existing)
  }

  const birthdaysByDay = new Map<string, BirthdayEntry[]>()
  for (const birthday of birthdays) {
    const key = startOfDay(new Date(birthday.date)).toISOString()
    const existing = birthdaysByDay.get(key) ?? []
    existing.push(birthday)
    birthdaysByDay.set(key, existing)
  }

  return (
    <div role="grid" aria-label={format(month, "MMMM yyyy", { locale: pt })}>
      {/* Header */}
      <div role="row" className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="text-center font-mono text-[9px] uppercase text-ink-3 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = startOfDay(day).toISOString()
          const daySessions = (sessionsByDay.get(key) ?? [])
            .slice()
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
          const isCurrentMonth = isSameMonth(day, month)
          const today = isToday(day)
          const dayNum = format(day, "d")
          const visibleSessions = daySessions.slice(0, 3)
          const extraCount = daySessions.length - 3
          const dayBirthdays = birthdaysByDay.get(key) ?? []
          const birthdayNames = dayBirthdays.map((b) => b.fullName).join(", ")

          return (
            <button
              key={key}
              role="gridcell"
              onClick={() => onSelectDay(day)}
              aria-label={[
                `${format(day, "d 'de' MMMM", { locale: pt })}, ${daySessions.length} ${daySessions.length === 1 ? "sessão" : "sessões"}`,
                dayBirthdays.length > 0 ? `aniversário de ${birthdayNames}` : null,
              ]
                .filter(Boolean)
                .join(", ")}
              className={[
                "flex flex-col items-center py-1.5 px-0.5 min-h-[112px] rounded transition-colors hover:bg-surface",
                !isCurrentMonth && "opacity-30",
                today && "ring-1 ring-foreground ring-inset",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="text-xs font-medium leading-none mb-1">{dayNum}</span>
              <div className="flex flex-col gap-1 w-full px-1">
                {/* Aniversários primeiro — sempre visíveis, não entram na contagem
                    de "+N" das sessões (raros, mas quando há, o nome tem de aparecer,
                    não só num tooltip). */}
                {dayBirthdays.map((b) => (
                  <div
                    key={b.playerId}
                    className="w-full rounded-sm px-1.5 py-1 overflow-hidden bg-pink-500 dark:bg-pink-600"
                    aria-hidden="true"
                  >
                    <span className="flex items-center gap-1 truncate text-[11px] leading-tight font-medium text-white">
                      <Cake className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{b.fullName}</span>
                    </span>
                  </div>
                ))}
                {/* Sessões ordenadas por hora — a mais cedo fica em cima */}
                {visibleSessions.map((s) => {
                  const config = SESSION_TYPE_COLORS[s.type]
                  const time = format(new Date(s.scheduled_at), "HH:mm")
                  const isCancelled = s.status === "cancelled"
                  return (
                    <div
                      key={s.id}
                      className="w-full rounded-sm px-1.5 py-1 overflow-hidden"
                      style={{ backgroundColor: config?.bg, opacity: isCancelled ? 0.5 : 1 }}
                      aria-hidden="true"
                    >
                      <span className="block truncate text-[11px] leading-tight font-medium text-white">
                        {time} {config?.label}
                      </span>
                    </div>
                  )
                })}
                {extraCount > 0 && (
                  <span className="text-[9px] text-ink-3 leading-none text-center">+{extraCount}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
