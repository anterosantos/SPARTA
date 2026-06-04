"use client"

import { useState } from "react"
import {
  isSameDay,
  startOfDay,
  endOfDay,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
} from "date-fns"
import { pt } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Session } from "@/lib/schemas/sessions"
import { DayChipStrip } from "@/components/ui/day-chip-strip"
import { SessionBlock } from "@/components/ui/session-block"
import { NextSevenDaysList } from "@/components/ui/next-seven-days-list"
import { EmptyState } from "@/components/ui/empty-state"
import { Calendar } from "lucide-react"

interface CalendarWeekViewProps {
  allSessions: Session[]
  isCoach: boolean
  sessionBasePath?: string
}

export function CalendarWeekView({ allSessions, sessionBasePath = "/sessoes" }: CalendarWeekViewProps) {
  const today = startOfDay(new Date())
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(today, { weekStartsOn: 1 })
  )
  const [selectedDate, setSelectedDate] = useState<Date>(today)

  // Compute weekDays client-side so week navigation works without server round-trips
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)
    const sessions = allSessions.filter((s) => {
      const d = new Date(s.scheduled_at)
      return d >= dayStart && d <= dayEnd
    })
    return { date, sessions }
  })

  // Next 7 days sessions — always relative to today, independent of week view
  const todayStart = startOfDay(new Date())
  const next7End = endOfDay(addDays(new Date(), 7))
  const next7Sessions = allSessions
    .filter((s) => {
      const d = new Date(s.scheduled_at)
      return d >= todayStart && d <= next7End
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )

  const daySessions =
    weekDays.find((wd) => isSameDay(wd.date, selectedDate))?.sessions ?? []

  const goToPrevWeek = () => {
    const prev = subWeeks(weekStart, 1)
    setWeekStart(prev)
    setSelectedDate(prev) // select Monday of new week
  }

  const goToNextWeek = () => {
    const next = addWeeks(weekStart, 1)
    setWeekStart(next)
    setSelectedDate(next)
  }

  const weekEndDate = addDays(weekStart, 6)
  const weekLabel =
    format(weekStart, "d", { locale: pt }) +
    " – " +
    format(weekEndDate, "d MMM yyyy", { locale: pt })

  return (
    <div className="space-y-6">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goToPrevWeek}
          aria-label="Semana anterior"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>

        <p className="text-xs font-mono uppercase text-muted-foreground capitalize tracking-wide">
          {weekLabel}
        </p>

        <button
          type="button"
          onClick={goToNextWeek}
          aria-label="Semana seguinte"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      <DayChipStrip
        weekDays={weekDays}
        selectedDate={selectedDate}
        onSelectDay={setSelectedDate}
      />

      {daySessions.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
          title="Sem sessões"
          description="Não há sessões para este dia."
        />
      ) : (
        <div className="space-y-2">
          {daySessions.map((session) => (
            <SessionBlock key={session.id} session={session} sessionBasePath={sessionBasePath} />
          ))}
        </div>
      )}

      <NextSevenDaysList sessions={next7Sessions} sessionBasePath={sessionBasePath} />
    </div>
  )
}
