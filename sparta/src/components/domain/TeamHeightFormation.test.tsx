import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamHeightFormation, heightToSizePx, heightToColor } from "./TeamHeightFormation";
import type { PlayerFormationItem } from "@/lib/actions/team-aggregate";

function makePlayer(overrides: Partial<PlayerFormationItem> = {}): PlayerFormationItem {
  return {
    playerId: "p1",
    playerName: "João Silva",
    position: "MC",
    ageGroup: "senior",
    jerseyNum: 8,
    weightKg: 70,
    hasWeightReading: true,
    heightCm: 160,
    hasHeightReading: true,
    ...overrides,
  };
}

describe("heightToSizePx", () => {
  it("devolve o tamanho mínimo no limite inferior (130cm)", () => {
    expect(heightToSizePx(130)).toBe(24);
  });

  it("devolve o tamanho máximo no limite superior (210cm)", () => {
    expect(heightToSizePx(210)).toBe(64);
  });

  it("é monótono crescente com a altura", () => {
    expect(heightToSizePx(140)).toBeLessThan(heightToSizePx(170));
    expect(heightToSizePx(170)).toBeLessThan(heightToSizePx(200));
  });

  it("faz clamp de alturas fora do intervalo [130, 210]", () => {
    expect(heightToSizePx(50)).toBe(heightToSizePx(130));
    expect(heightToSizePx(300)).toBe(heightToSizePx(210));
  });
});

describe("heightToColor", () => {
  it("devolve a cor azul (baixo) no limite inferior", () => {
    expect(heightToColor(130)).toBe("rgb(37, 99, 235)");
  });

  it("devolve a cor vermelha (alto) no limite superior", () => {
    expect(heightToColor(210)).toBe("rgb(220, 38, 38)");
  });

  it("devolve a cor âmbar (médio) a meio da escala", () => {
    expect(heightToColor(170)).toBe("rgb(245, 158, 11)");
  });

  it("faz clamp de alturas fora do intervalo [130, 210]", () => {
    expect(heightToColor(50)).toBe(heightToColor(130));
    expect(heightToColor(300)).toBe(heightToColor(210));
  });
});

describe("TeamHeightFormation", () => {
  it("mostra estado vazio sem jogadores", () => {
    render(<TeamHeightFormation players={[]} />);
    expect(screen.getByText("Sem jogadores no plantel")).toBeInTheDocument();
  });

  it("renderiza uma bola por jogador com a altura em cm", () => {
    render(
      <TeamHeightFormation
        players={[
          makePlayer({ playerId: "p1", playerName: "João Silva", heightCm: 182.5 }),
          makePlayer({ playerId: "p2", playerName: "Rui Costa", position: "DC", heightCm: 175 }),
        ]}
      />
    );
    expect(screen.getByText("182,5 cm")).toBeInTheDocument();
    expect(screen.getByText("175 cm")).toBeInTheDocument();
  });

  it("mostra a altura e assinala 'sem leitura' quando o jogador não tem altura registada", () => {
    render(
      <TeamHeightFormation
        players={[makePlayer({ hasHeightReading: false, heightCm: 160 })]}
      />
    );
    expect(screen.getByText("160 cm")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/altura por omissão, sem leitura registada/i)
    ).toBeInTheDocument();
  });

  it("uma bola de jogador mais alto é fisicamente maior do que a de um mais baixo", () => {
    const { container } = render(
      <TeamHeightFormation
        players={[
          makePlayer({ playerId: "short", position: "MC", heightCm: 150 }),
          makePlayer({ playerId: "tall", position: "DC", heightCm: 200 }),
        ]}
      />
    );
    const shortBall = container.querySelector('[aria-label*="150 cm"]') as HTMLElement;
    const tallBall = container.querySelector('[aria-label*="200 cm"]') as HTMLElement;
    expect(shortBall).not.toBeNull();
    expect(tallBall).not.toBeNull();
    const shortWidth = parseFloat(shortBall.style.width);
    const tallWidth = parseFloat(tallBall.style.width);
    expect(tallWidth).toBeGreaterThan(shortWidth);
  });

  it("mostra o número da camisola dentro da bola, ou '?' quando ausente", () => {
    render(<TeamHeightFormation players={[makePlayer({ jerseyNum: null })]} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("SVG do campo tem o aria-label correcto", () => {
    const { container } = render(<TeamHeightFormation players={[makePlayer()]} />);
    const svg = container.querySelector(
      'svg[aria-label="Campo de futebol — jogadores por posição, tamanho e cor representam a altura"]'
    );
    expect(svg).toBeInTheDocument();
  });

  it("a cor de fundo da bola segue a escala de cor da altura", () => {
    const { container } = render(
      <TeamHeightFormation players={[makePlayer({ heightCm: 130 })]} />
    );
    const ball = container.querySelector('[aria-label*="130 cm"]') as HTMLElement;
    expect(ball.style.backgroundColor).toBe("rgb(37, 99, 235)");
  });

  it("bola de jogador sem leitura tem contorno tracejado", () => {
    const { container } = render(
      <TeamHeightFormation players={[makePlayer({ hasHeightReading: false })]} />
    );
    const ball = container.querySelector('[aria-label*="por omissão"]') as HTMLElement;
    expect(ball.className).toContain("border-dashed");
  });

  it("mostra legenda da escala com os limites min/max", () => {
    render(<TeamHeightFormation players={[makePlayer()]} />);
    expect(screen.getByText("130 cm")).toBeInTheDocument();
    expect(screen.getByText("210 cm")).toBeInTheDocument();
  });
});
