import { describe, it, expect } from "vitest";
import { deriveMatchPhase, formatMatchClock, HALF_TIME_BREAK_SECONDS } from "./match-clock";

describe("deriveMatchPhase", () => {
  it("not_started quando não há nenhum marcador", () => {
    expect(
      deriveMatchPhase({ matchStartAt: null, firstHalfEndAt: null, secondHalfStartAt: null })
    ).toBe("not_started");
  });

  it("first_half quando só há match_start", () => {
    expect(
      deriveMatchPhase({
        matchStartAt: "2026-09-21T10:00:00.000Z",
        firstHalfEndAt: null,
        secondHalfStartAt: null,
      })
    ).toBe("first_half");
  });

  it("break quando há match_start + half_time", () => {
    expect(
      deriveMatchPhase({
        matchStartAt: "2026-09-21T10:00:00.000Z",
        firstHalfEndAt: "2026-09-21T10:35:00.000Z",
        secondHalfStartAt: null,
      })
    ).toBe("break");
  });

  it("second_half quando há os três marcadores", () => {
    expect(
      deriveMatchPhase({
        matchStartAt: "2026-09-21T10:00:00.000Z",
        firstHalfEndAt: "2026-09-21T10:35:00.000Z",
        secondHalfStartAt: "2026-09-21T10:50:00.000Z",
      })
    ).toBe("second_half");
  });

  it("second_half prevalece mesmo sem firstHalfEndAt (estado corrigido manualmente)", () => {
    expect(
      deriveMatchPhase({
        matchStartAt: "2026-09-21T10:00:00.000Z",
        firstHalfEndAt: null,
        secondHalfStartAt: "2026-09-21T10:50:00.000Z",
      })
    ).toBe("second_half");
  });
});

describe("formatMatchClock", () => {
  it("formata segundos como mm:ss com zero à esquerda", () => {
    expect(formatMatchClock(0)).toBe("00:00");
    expect(formatMatchClock(5)).toBe("00:05");
    expect(formatMatchClock(65)).toBe("01:05");
  });

  it("trunca frações de segundo", () => {
    expect(formatMatchClock(65.9)).toBe("01:05");
  });

  it("formata minutos de dois dígitos correctamente até bem acima de uma hora", () => {
    expect(formatMatchClock(45 * 60)).toBe("45:00");
    expect(formatMatchClock(90 * 60 + 30)).toBe("90:30");
  });

  it("prefixa negativos com '-' (ex.: intervalo a decorrer além do previsto)", () => {
    expect(formatMatchClock(-1)).toBe("-00:01");
    expect(formatMatchClock(-65)).toBe("-01:05");
  });
});

describe("HALF_TIME_BREAK_SECONDS", () => {
  it("é 15 minutos", () => {
    expect(HALF_TIME_BREAK_SECONDS).toBe(900);
  });
});
