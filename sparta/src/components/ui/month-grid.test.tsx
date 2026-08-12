import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MonthGrid } from "./month-grid"
import { SESSION_TYPE_COLORS } from "@/lib/constants/session-colors"
import type { Session } from "@/lib/schemas/sessions"

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    club_id: "club-1",
    season_id: "season-1",
    type: "training",
    scheduled_at: "2026-08-05T10:00:00.000Z",
    duration_min: 90,
    location: "Campo A",
    status: "scheduled",
    notes: null,
    created_by: "user-1",
    created_at: "2026-08-01T00:00:00.000Z",
    concentration_time: null,
    opponent_name: null,
    ...overrides,
  }
}

const MONTH = new Date("2026-08-01T00:00:00.000Z")

describe("MonthGrid", () => {
  it("mostra um retângulo preenchido a cor por sessão, com hora e tipo, não uma linha ou pontinho", () => {
    render(
      <MonthGrid
        sessions={[makeSession({ scheduled_at: "2026-08-05T10:00:00.000Z" })]}
        month={MONTH}
        onSelectDay={vi.fn()}
      />
    )
    const cell = screen.getByRole("gridcell", { name: /^5 de agosto.*1 sessão/i })
    const chip = cell.querySelector("div[aria-hidden]")
    expect(chip).not.toBeNull()
    expect(chip).toHaveClass("w-full", "rounded-sm")
    expect(chip).toHaveStyle({ backgroundColor: SESSION_TYPE_COLORS.training.bg })
    expect(chip).toHaveTextContent("Treino")
    // Não deve restar nenhum pontinho circular nem barra fina do design anterior
    expect(cell.querySelector(".rounded-full")).toBeNull()
    expect(cell.querySelector(".h-1")).toBeNull()
  })

  it("mostra a hora local dentro do retângulo", () => {
    render(
      <MonthGrid
        sessions={[makeSession({ scheduled_at: "2026-08-05T10:00:00.000Z" })]}
        month={MONTH}
        onSelectDay={vi.fn()}
      />
    )
    const cell = screen.getByRole("gridcell", { name: /^5 de agosto.*1 sessão/i })
    const chip = cell.querySelector("div[aria-hidden]")
    expect(chip?.textContent).toMatch(/^\d{2}:\d{2} Treino$/)
  })

  it("ordena os retângulos por hora — a sessão mais cedo fica em cima", () => {
    const morning = makeSession({
      id: "sess-morning",
      type: "training",
      scheduled_at: "2026-08-05T08:00:00.000Z",
    })
    const evening = makeSession({
      id: "sess-evening",
      type: "match",
      scheduled_at: "2026-08-05T18:00:00.000Z",
    })
    // Inserido fora de ordem de propósito para provar que o componente ordena
    render(
      <MonthGrid sessions={[evening, morning]} month={MONTH} onSelectDay={vi.fn()} />
    )

    const cell = screen.getByRole("gridcell", { name: /^5 de agosto.*2 sessões/i })
    const chips = cell.querySelectorAll("div[aria-hidden]")
    expect(chips).toHaveLength(2)
    expect(chips[0]).toHaveStyle({ backgroundColor: SESSION_TYPE_COLORS.training.bg })
    expect(chips[1]).toHaveStyle({ backgroundColor: SESSION_TYPE_COLORS.match.bg })
  })

  it("mostra no máximo 3 retângulos e um indicador '+N' para o resto", () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession({
        id: `sess-${i}`,
        scheduled_at: `2026-08-05T${String(8 + i).padStart(2, "0")}:00:00.000Z`,
      })
    )
    render(<MonthGrid sessions={sessions} month={MONTH} onSelectDay={vi.fn()} />)

    const cell = screen.getByRole("gridcell", { name: /^5 de agosto.*5 sessões/i })
    const chips = cell.querySelectorAll("div[aria-hidden]")
    expect(chips).toHaveLength(3)
    expect(cell).toHaveTextContent("+2")
  })

  it("chama onSelectDay ao clicar num dia", () => {
    const onSelectDay = vi.fn()
    render(<MonthGrid sessions={[]} month={MONTH} onSelectDay={onSelectDay} />)

    screen.getByRole("gridcell", { name: /^5 de agosto.*0 sessões/i }).click()
    expect(onSelectDay).toHaveBeenCalledTimes(1)
  })
})
