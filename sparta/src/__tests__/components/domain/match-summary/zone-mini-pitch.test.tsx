import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ZoneMiniPitch } from "@/components/domain/match-summary/zone-mini-pitch";
import { MATCH_ZONES } from "@/lib/schemas/match-events";

describe("<ZoneMiniPitch>", () => {
  it("renderiza 12 células (grelha 3x4 igual ao selector de zonas)", () => {
    const { container } = render(<ZoneMiniPitch highlightZone="att_center" />);
    expect(container.querySelectorAll("[title]")).toHaveLength(MATCH_ZONES.length);
  });

  it("modo highlightZone tem aria-label com o nome da zona", () => {
    render(<ZoneMiniPitch highlightZone="def_left" />);
    expect(screen.getByRole("img", { name: "Zona: Defesa esquerda" })).toBeInTheDocument();
  });

  it("modo counts tem aria-label de distribuição agregada", () => {
    render(<ZoneMiniPitch counts={{ att_center: 3, def_left: 1 }} />);
    expect(
      screen.getByRole("img", { name: "Distribuição de eventos por zona do campo" })
    ).toBeInTheDocument();
  });

  it("célula sem eventos em modo counts fica sem estilo de intensidade", () => {
    const { container } = render(<ZoneMiniPitch counts={{ att_center: 3 }} />);
    const cells = container.querySelectorAll("[title]");
    const emptyCell = Array.from(cells).find((c) => c.getAttribute("title")?.endsWith(": 0"));
    expect(emptyCell).toBeDefined();
    expect((emptyCell as HTMLElement).style.opacity).toBe("");
  });
});
