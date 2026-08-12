import { describe, it, expect } from "vitest";
import { buildCalendarViewQuery } from "@/lib/utils/calendar-query";

describe("buildCalendarViewQuery", () => {
  it("devolve string vazia na vista por omissão (mês, sem mês alvo)", () => {
    expect(buildCalendarViewQuery({})).toBe("");
    expect(buildCalendarViewQuery({ vista: "mes" })).toBe("");
  });

  it("mantém o mes alvo em vista de mês, sem vista= (é o default)", () => {
    expect(buildCalendarViewQuery({ vista: "mes", mes: "2026-08" })).toBe(
      "?mes=2026-08"
    );
  });

  it("mantém o mes alvo mesmo sem vista= explícito", () => {
    expect(buildCalendarViewQuery({ mes: "2026-08" })).toBe("?mes=2026-08");
  });

  it("inclui vista=semana explicitamente (já não é o default)", () => {
    expect(buildCalendarViewQuery({ vista: "semana" })).toBe("?vista=semana");
  });

  it("ignora mes quando vista é 'semana' (não deixa vazar estado irrelevante)", () => {
    expect(buildCalendarViewQuery({ vista: "semana", mes: "2026-08" })).toBe(
      "?vista=semana"
    );
  });
});
