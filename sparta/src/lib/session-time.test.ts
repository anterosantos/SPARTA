import { describe, it, expect } from "vitest";
import { sessionEndDate } from "./session-time";

describe("sessionEndDate", () => {
  it("soma a duração (minutos) à hora de início", () => {
    const end = sessionEndDate("2026-06-01T10:00:00.000Z", 90);
    expect(end.toISOString()).toBe("2026-06-01T11:30:00.000Z");
  });

  it("lida com durações que cruzam a hora seguinte", () => {
    const end = sessionEndDate("2026-06-01T10:45:00.000Z", 30);
    expect(end.toISOString()).toBe("2026-06-01T11:15:00.000Z");
  });

  it("duração 0 devolve a mesma hora de início", () => {
    const end = sessionEndDate("2026-06-01T10:00:00.000Z", 0);
    expect(end.toISOString()).toBe("2026-06-01T10:00:00.000Z");
  });
});
