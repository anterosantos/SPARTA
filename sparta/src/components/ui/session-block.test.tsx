import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { format } from "date-fns"
import { SessionBlock } from "./session-block"
import { sessionEndDate } from "@/lib/session-time"
import type { Session } from "@/lib/schemas/sessions"

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string; [key: string]: unknown }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/hooks/useDarkMode", () => ({ useDarkMode: () => false }))

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    club_id: "club-1",
    season_id: "season-1",
    type: "training",
    scheduled_at: "2026-06-01T10:00:00.000Z",
    duration_min: 90,
    location: "Campo A",
    status: "scheduled",
    notes: null,
    created_by: "user-1",
    created_at: "2026-06-01T09:00:00.000Z",
    concentration_time: null,
    opponent_name: null,
    ...overrides,
  }
}

describe("SessionBlock", () => {
  it("aplica cor de fundo #2563EB para training", () => {
    const { container } = render(<SessionBlock session={makeSession({ type: "training" })} />)
    const link = container.querySelector("a")
    expect(link).not.toBeNull()
    expect(link).toHaveStyle({ backgroundColor: "#2563EB" })
  })

  it("aplica cor de fundo #DC2626 para match", () => {
    const { container } = render(<SessionBlock session={makeSession({ type: "match" })} />)
    const link = container.querySelector("a")
    expect(link).toHaveStyle({ backgroundColor: "#DC2626" })
  })

  it("aplica cor de fundo #CA8A04 para friendly", () => {
    const { container } = render(<SessionBlock session={makeSession({ type: "friendly" })} />)
    const link = container.querySelector("a")
    expect(link).toHaveStyle({ backgroundColor: "#CA8A04" })
  })

  it("sessão cancelada tem opacidade reduzida e label 'Cancelada'", () => {
    const { container } = render(
      <SessionBlock session={makeSession({ status: "cancelled" })} />
    )
    const link = container.querySelector("a")
    expect(link).toHaveStyle({ opacity: "0.5" })
    expect(screen.getByText("Cancelada")).toBeInTheDocument()
  })

  it("navega para /sessoes/[id]", () => {
    const { container } = render(<SessionBlock session={makeSession({ id: "sess-abc" })} />)
    const link = container.querySelector("a")
    expect(link).toHaveAttribute("href", "/sessoes/sess-abc")
  })

  it("mostra 'vs adversário' para jogo/amigável com opponent_name definido", () => {
    render(<SessionBlock session={makeSession({ type: "friendly", opponent_name: "Equipa" })} />)
    expect(screen.getByText("Amigável vs Equipa")).toBeInTheDocument()
  })

  it("não mostra 'vs' quando opponent_name não está definido", () => {
    render(<SessionBlock session={makeSession({ type: "match", opponent_name: null })} />)
    expect(screen.getByText("Jogo")).toBeInTheDocument()
  })

  it("não mostra 'vs' para treino mesmo que opponent_name esteja definido", () => {
    render(<SessionBlock session={makeSession({ type: "training", opponent_name: "Equipa" })} />)
    expect(screen.getByText("Treino")).toBeInTheDocument()
  })

  it("mostra intervalo de horas calculado a partir da duração (início - fim)", () => {
    const scheduledAt = "2026-06-01T10:00:00.000Z"
    const durationMin = 90
    const start = format(new Date(scheduledAt), "HH:mm")
    const end = format(sessionEndDate(scheduledAt, durationMin), "HH:mm")

    render(<SessionBlock session={makeSession({ scheduled_at: scheduledAt, duration_min: durationMin })} />)
    expect(screen.getByText(`${start} - ${end}`)).toBeInTheDocument()
  })
})
