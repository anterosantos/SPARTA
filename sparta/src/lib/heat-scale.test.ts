import { describe, it, expect } from "vitest";
import { makeHeatScale } from "./heat-scale";

describe("makeHeatScale", () => {
  it("aceita limites min/max e tamanhos min/max customizados", () => {
    const scale = makeHeatScale(0, 100, 10, 20);
    expect(scale.toSizePx(0)).toBe(10);
    expect(scale.toSizePx(100)).toBe(20);
    expect(scale.toSizePx(50)).toBe(15);
  });

  it("usa 24/64 como tamanhos por omissão", () => {
    const scale = makeHeatScale(0, 100);
    expect(scale.toSizePx(0)).toBe(24);
    expect(scale.toSizePx(100)).toBe(64);
  });

  it("duas instâncias com limites diferentes não interferem entre si", () => {
    const weightLike = makeHeatScale(30, 150);
    const heightLike = makeHeatScale(100, 220);
    expect(weightLike.toSizePx(30)).toBe(heightLike.toSizePx(100));
    expect(weightLike.toColor(150)).toBe(heightLike.toColor(220));
  });

  it("gera um gradiente CSS válido para a legenda", () => {
    const scale = makeHeatScale(0, 100);
    expect(scale.legendGradient).toMatch(/^linear-gradient\(to right, .*\)$/);
    expect(scale.legendGradient).toContain("rgb(37,99,235) 0%");
    expect(scale.legendGradient).toContain("rgb(220,38,38) 100%");
  });
});
