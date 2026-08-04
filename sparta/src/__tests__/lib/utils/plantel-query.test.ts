import { describe, it, expect } from "vitest";
import { buildPlantelSortFilterQuery } from "@/lib/utils/plantel-query";

describe("buildPlantelSortFilterQuery", () => {
  it("devolve string vazia na ordenação por omissão sem filtro de posição", () => {
    expect(buildPlantelSortFilterQuery({ sort: "nome", position: null })).toBe("");
  });

  it("inclui ordenar quando diferente de 'nome'", () => {
    expect(buildPlantelSortFilterQuery({ sort: "numero", position: null })).toBe(
      "?ordenar=numero"
    );
  });

  it("inclui posicao quando definida", () => {
    expect(buildPlantelSortFilterQuery({ sort: "nome", position: "GR" })).toBe(
      "?posicao=GR"
    );
  });

  it("combina ordenar e posicao", () => {
    expect(
      buildPlantelSortFilterQuery({ sort: "posicao", position: "MC" })
    ).toBe("?ordenar=posicao&posicao=MC");
  });
});
