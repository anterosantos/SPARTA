import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamWeightFormation, weightToSizePx, weightToColor } from "./TeamWeightFormation";
import type { PlayerFormationItem } from "@/lib/actions/team-aggregate";

function makePlayer(overrides: Partial<PlayerFormationItem> = {}): PlayerFormationItem {
  return {
    playerId: "p1",
    playerName: "João Silva",
    position: "MC",
    ageGroup: "senior",
    jerseyNum: 8,
    weightKg: 50,
    hasWeightReading: true,
    heightCm: 170,
    hasHeightReading: true,
    ...overrides,
  };
}

describe("weightToSizePx", () => {
  it("devolve o tamanho mínimo no limite inferior (30kg)", () => {
    expect(weightToSizePx(30)).toBe(24);
  });

  it("devolve o tamanho máximo no limite superior (110kg)", () => {
    expect(weightToSizePx(110)).toBe(64);
  });

  it("é monótono crescente com o peso", () => {
    expect(weightToSizePx(50)).toBeLessThan(weightToSizePx(80));
    expect(weightToSizePx(80)).toBeLessThan(weightToSizePx(100));
  });

  it("faz clamp de pesos fora do intervalo [30, 110]", () => {
    expect(weightToSizePx(10)).toBe(weightToSizePx(30));
    expect(weightToSizePx(500)).toBe(weightToSizePx(110));
  });
});

describe("weightToColor", () => {
  it("devolve a cor azul (leve) no limite inferior", () => {
    expect(weightToColor(30)).toBe("rgb(37, 99, 235)");
  });

  it("devolve a cor vermelha (pesado) no limite superior", () => {
    expect(weightToColor(110)).toBe("rgb(220, 38, 38)");
  });

  it("devolve a cor âmbar (médio) a meio da escala", () => {
    expect(weightToColor(70)).toBe("rgb(245, 158, 11)");
  });

  it("faz clamp de pesos fora do intervalo [30, 110]", () => {
    expect(weightToColor(10)).toBe(weightToColor(30));
    expect(weightToColor(500)).toBe(weightToColor(110));
  });
});

describe("TeamWeightFormation", () => {
  it("mostra estado vazio sem jogadores", () => {
    render(<TeamWeightFormation players={[]} />);
    expect(screen.getByText("Sem jogadores no plantel")).toBeInTheDocument();
  });

  it("renderiza uma bola por jogador com o peso em kg", () => {
    render(
      <TeamWeightFormation
        players={[
          makePlayer({ playerId: "p1", playerName: "João Silva", weightKg: 72.5 }),
          makePlayer({ playerId: "p2", playerName: "Rui Costa", position: "DC", weightKg: 68 }),
        ]}
      />
    );
    expect(screen.getByText("72,5 kg")).toBeInTheDocument();
    expect(screen.getByText("68 kg")).toBeInTheDocument();
  });

  it("mostra 50kg e assinala 'sem leitura' quando o jogador não tem peso registado", () => {
    render(
      <TeamWeightFormation
        players={[makePlayer({ hasWeightReading: false, weightKg: 50 })]}
      />
    );
    expect(screen.getByText("50 kg")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/peso por omissão, sem leitura registada/i)
    ).toBeInTheDocument();
  });

  it("uma bola de jogador mais pesado é fisicamente maior do que a de um mais leve", () => {
    const { container } = render(
      <TeamWeightFormation
        players={[
          makePlayer({ playerId: "light", position: "MC", weightKg: 40 }),
          makePlayer({ playerId: "heavy", position: "DC", weightKg: 100 }),
        ]}
      />
    );
    const lightBall = container.querySelector('[aria-label*="40 kg"]') as HTMLElement;
    const heavyBall = container.querySelector('[aria-label*="100 kg"]') as HTMLElement;
    expect(lightBall).not.toBeNull();
    expect(heavyBall).not.toBeNull();
    const lightWidth = parseFloat(lightBall.style.width);
    const heavyWidth = parseFloat(heavyBall.style.width);
    expect(heavyWidth).toBeGreaterThan(lightWidth);
  });

  it("mostra o número da camisola dentro da bola, ou '?' quando ausente", () => {
    render(<TeamWeightFormation players={[makePlayer({ jerseyNum: null })]} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("SVG do campo tem o aria-label correcto", () => {
    const { container } = render(<TeamWeightFormation players={[makePlayer()]} />);
    const svg = container.querySelector(
      'svg[aria-label="Campo de futebol — jogadores por posição, tamanho e cor representam o peso"]'
    );
    expect(svg).toBeInTheDocument();
  });

  it("a cor de fundo da bola segue a escala de cor do peso", () => {
    const { container } = render(
      <TeamWeightFormation players={[makePlayer({ weightKg: 30 })]} />
    );
    const ball = container.querySelector('[aria-label*="30 kg"]') as HTMLElement;
    expect(ball.style.backgroundColor).toBe("rgb(37, 99, 235)");
  });

  it("bola de jogador sem leitura tem contorno tracejado", () => {
    const { container } = render(
      <TeamWeightFormation players={[makePlayer({ hasWeightReading: false })]} />
    );
    const ball = container.querySelector('[aria-label*="por omissão"]') as HTMLElement;
    expect(ball.className).toContain("border-dashed");
  });

  it("mostra legenda da escala com os limites min/max", () => {
    render(<TeamWeightFormation players={[makePlayer()]} />);
    expect(screen.getByText("30 kg")).toBeInTheDocument();
    expect(screen.getByText("110 kg")).toBeInTheDocument();
  });
});
