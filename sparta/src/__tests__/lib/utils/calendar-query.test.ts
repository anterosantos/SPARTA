import { describe, it, expect } from "vitest";
import { buildCalendarViewQuery } from "@/lib/utils/calendar-query";

describe("buildCalendarViewQuery", () => {
  it("devolve string vazia na vista por omissão (semana, não-cumulativo)", () => {
    expect(buildCalendarViewQuery({})).toBe("");
    expect(buildCalendarViewQuery({ vista: "semana" })).toBe("");
  });

  it("inclui vista=mes e mes quando em vista de mês", () => {
    expect(buildCalendarViewQuery({ vista: "mes", mes: "2026-08" })).toBe(
      "?vista=mes&mes=2026-08"
    );
  });

  it("omite mes quando em vista de mês sem mes definido", () => {
    expect(buildCalendarViewQuery({ vista: "mes" })).toBe("?vista=mes");
  });

  it("inclui cumulativo=true independentemente da vista", () => {
    expect(buildCalendarViewQuery({ cumulativo: "true" })).toBe(
      "?cumulativo=true"
    );
  });

  it("combina cumulativo e vista=mes", () => {
    expect(
      buildCalendarViewQuery({ cumulativo: "true", vista: "mes", mes: "2026-01" })
    ).toBe("?cumulativo=true&vista=mes&mes=2026-01");
  });

  it("ignora mes quando vista não é 'mes' (não deixa vazar estado irrelevante)", () => {
    expect(buildCalendarViewQuery({ vista: "semana", mes: "2026-08" })).toBe(
      ""
    );
  });
});
