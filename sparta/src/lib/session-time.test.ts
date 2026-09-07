import { describe, it, expect } from "vitest";
import {
  sessionEndDate,
  addWeeksInTimeZone,
  zonedParts,
  zonedWallClockToUtc,
} from "./session-time";

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

// Hora de parede em Europe/Lisbon (HH:mm, 24h) para verificação legível.
function lisbonTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Lisbon",
  });
}

describe("addWeeksInTimeZone", () => {
  it("mantém a hora de parede ao atravessar o fim do horário de verão (outubro)", () => {
    // 19:45 de Lisboa em pleno verão (UTC+1) → 18:45Z
    const base = "2026-10-20T18:45:00.000Z";
    expect(lisbonTime(base)).toBe("19:45");

    // +1 semana cai a 27/10, já depois da mudança (25/10) — deve continuar 19:45
    const wk1 = addWeeksInTimeZone(base, 1);
    expect(wk1.toISOString()).toBe("2026-10-27T19:45:00.000Z");
    expect(lisbonTime(wk1.toISOString())).toBe("19:45");

    const wk3 = addWeeksInTimeZone(base, 3);
    expect(lisbonTime(wk3.toISOString())).toBe("19:45");
  });

  it("mantém a hora de parede ao atravessar o início do horário de verão (março)", () => {
    // 10:00 de Lisboa em inverno (UTC+0) — mudança para verão a 29/03/2026
    const base = "2026-03-15T10:00:00.000Z";
    expect(lisbonTime(base)).toBe("10:00");
    const wk3 = addWeeksInTimeZone(base, 3); // 05/04, já em verão
    expect(wk3.toISOString()).toBe("2026-04-05T09:00:00.000Z");
    expect(lisbonTime(wk3.toISOString())).toBe("10:00");
  });

  it("sem mudança de hora, equivale a somar 7×24h", () => {
    const base = "2026-02-10T19:45:00.000Z";
    const wk2 = addWeeksInTimeZone(base, 2);
    expect(wk2.getTime()).toBe(new Date(base).getTime() + 14 * 24 * 60 * 60 * 1000);
  });

  it("preserva o dia da semana", () => {
    const base = "2026-10-20T18:45:00.000Z"; // terça
    for (let i = 1; i <= 6; i++) {
      expect(new Date(addWeeksInTimeZone(base, i)).getUTCDay()).toBe(
        new Date(base).getUTCDay()
      );
    }
  });
});

describe("zonedParts / zonedWallClockToUtc", () => {
  it("round-trip preserva a hora de parede", () => {
    const iso = "2026-11-03T19:45:00.000Z";
    const p = zonedParts(new Date(iso));
    const back = zonedWallClockToUtc(p.year, p.month, p.day, p.hour, p.minute);
    expect(back.toISOString()).toBe(iso);
  });

  it("resolve o offset de verão", () => {
    const d = zonedWallClockToUtc(2026, 7, 1, 19, 45);
    expect(d.toISOString()).toBe("2026-07-01T18:45:00.000Z");
  });
});
