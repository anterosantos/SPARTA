import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ZoneMiniPitch } from "@/components/domain/match-summary/zone-mini-pitch";
import { MATCH_ZONES, LEGACY_MATCH_ZONES } from "@/lib/schemas/match-events";

describe("<ZoneMiniPitch>", () => {
  it("renderiza 24 células (grelha 4x6, esquema activo) quando a zona é activa", () => {
    const { container } = render(<ZoneMiniPitch highlightZone="att_end_left" />);
    expect(container.querySelectorAll("[title]")).toHaveLength(MATCH_ZONES.length);
    expect(container.firstElementChild).toHaveClass("grid-cols-4");
  });

  it("renderiza 12 células (grelha 3x4, esquema legado) quando a zona é de um jogo antigo", () => {
    const { container } = render(<ZoneMiniPitch highlightZone="att_center" />);
    expect(container.querySelectorAll("[title]")).toHaveLength(LEGACY_MATCH_ZONES.length);
    expect(container.firstElementChild).toHaveClass("grid-cols-3");
  });

  it("sem dados (sem highlightZone/counts) usa o esquema activo por omissão", () => {
    const { container } = render(<ZoneMiniPitch />);
    expect(container.querySelectorAll("[title]")).toHaveLength(MATCH_ZONES.length);
  });

  it("modo highlightZone tem aria-label com o nome da zona (esquema activo)", () => {
    render(<ZoneMiniPitch highlightZone="att_end_left" />);
    expect(
      screen.getByRole("img", { name: "Zona: Ataque linha de fundo esquerda" })
    ).toBeInTheDocument();
  });

  it("modo highlightZone tem aria-label com o nome da zona (esquema legado — jogo antigo)", () => {
    render(<ZoneMiniPitch highlightZone="def_left" />);
    expect(screen.getByRole("img", { name: "Zona: Defesa esquerda" })).toBeInTheDocument();
  });

  it("modo counts com chaves legadas usa a grelha 3x4 (jogo antigo)", () => {
    const { container } = render(<ZoneMiniPitch counts={{ att_center: 3, def_left: 1 }} />);
    expect(container.querySelectorAll("[title]")).toHaveLength(LEGACY_MATCH_ZONES.length);
  });

  it("modo counts com chaves do esquema activo usa a grelha 4x6", () => {
    const { container } = render(<ZoneMiniPitch counts={{ att_end_left: 3 }} />);
    expect(container.querySelectorAll("[title]")).toHaveLength(MATCH_ZONES.length);
  });

  it("modo counts tem aria-label de distribuição agregada", () => {
    render(<ZoneMiniPitch counts={{ att_end_left: 3, def_end_left: 1 }} />);
    expect(
      screen.getByRole("img", { name: "Distribuição de eventos por zona do campo" })
    ).toBeInTheDocument();
  });

  it("célula sem eventos em modo counts fica sem estilo de intensidade", () => {
    const { container } = render(<ZoneMiniPitch counts={{ att_end_left: 3 }} />);
    const cells = container.querySelectorAll("[title]");
    const emptyCell = Array.from(cells).find((c) => c.getAttribute("title")?.endsWith(": 0"));
    expect(emptyCell).toBeDefined();
    expect((emptyCell as HTMLElement).style.opacity).toBe("");
  });
});
