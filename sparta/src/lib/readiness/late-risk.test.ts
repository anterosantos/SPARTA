import { describe, it, expect } from "vitest";
import { computeLateRiskState, TRAVEL_MINUTES } from "./late-risk";
import { SchoolTermSchema } from "@/lib/schemas/school-schedule";
import type { WeeklySchedule } from "@/lib/schemas/school-schedule";

// Sessão de referência: quarta-feira 2026-08-19, 18:00 Europe/Lisbon.
// Em agosto, Portugal está em WEST (UTC+1), logo 18:00 Lisboa = 17:00 UTC.
const WEDNESDAY_SESSION_ISO = "2026-08-19T17:00:00.000Z";

const FULL_WEEKLY: WeeklySchedule = {
  mon_time: "13:00",
  tue_time: "13:00",
  wed_time: "13:00",
  thu_time: "13:00",
  fri_time: "13:00",
};

const ACTIVE_TERM = { startDate: "2026-08-01", endDate: "2026-09-01" };

describe("computeLateRiskState — I/O & Edge-Case Matrix", () => {
  // 1. Nunca preencheu
  it("devolve 'missing' quando não há horário preenchido (weekly === null)", () => {
    const result = computeLateRiskState(null, [], WEDNESDAY_SESSION_ISO);
    expect(result).toBe("missing");
  });

  // 2. Fora de período letivo
  it("devolve null quando o horário existe mas não há intervalo letivo ativo na data da sessão", () => {
    const result = computeLateRiskState(FULL_WEEKLY, [], WEDNESDAY_SESSION_ISO);
    expect(result).toBeNull();
  });

  it("devolve null quando existe um intervalo letivo mas não cobre a data da sessão", () => {
    const pastTerm = { startDate: "2020-01-01", endDate: "2020-06-30" };
    const result = computeLateRiskState(FULL_WEEKLY, [pastTerm], WEDNESDAY_SESSION_ISO);
    expect(result).toBeNull();
  });

  // 3. Chegada depois do início (exit_time + 60min > scheduled_at)
  it("devolve 'alert' quando a chegada calculada é depois do início da sessão", () => {
    // Saída 13:00 + 60min = 14:00 de chegada, sessão às 18:00 → mais de 60min de folga
    // Ajustar para forçar atraso: sessão às 13:30 (exit+60=14:00 > 13:30)
    const earlySessionISO = "2026-08-19T12:30:00.000Z"; // 13:30 Lisboa (WEST, +1h)
    const result = computeLateRiskState(FULL_WEEKLY, [ACTIVE_TERM], earlySessionISO);
    expect(result).toBe("alert");
  });

  // 4. Chegada exatamente à hora (exit_time + 60min === scheduled_at)
  it("devolve 'caution' quando a chegada calculada coincide exatamente com o início da sessão", () => {
    // Saída 13:00 + 60min = 14:00 de chegada → sessão precisa começar às 14:00 Lisboa = 13:00 UTC
    const exactSessionISO = "2026-08-19T13:00:00.000Z";
    const result = computeLateRiskState(FULL_WEEKLY, [ACTIVE_TERM], exactSessionISO);
    expect(result).toBe("caution");
  });

  // 5. Chegada com folga (exit_time + 60min < scheduled_at)
  it("devolve null quando a chegada calculada é antes do início da sessão (folga)", () => {
    // Saída 13:00 + 60min = 14:00 de chegada, sessão às 18:00 Lisboa → folga generosa
    const result = computeLateRiskState(FULL_WEEKLY, [ACTIVE_TERM], WEDNESDAY_SESSION_ISO);
    expect(result).toBeNull();
  });

  it("devolve null quando o dia da semana da sessão não tem hora de saída definida", () => {
    const weeklyNoWednesday: WeeklySchedule = { ...FULL_WEEKLY, wed_time: null };
    const result = computeLateRiskState(weeklyNoWednesday, [ACTIVE_TERM], WEDNESDAY_SESSION_ISO);
    expect(result).toBeNull();
  });

  it("TRAVEL_MINUTES é fixo em 60 (sem geolocalização/distância configurável)", () => {
    expect(TRAVEL_MINUTES).toBe(60);
  });
});

// 6. Intervalo de datas inválido (endDate < startDate) — validado ao nível do Zod schema
// do formulário, não do cálculo puro. Cobrimos aqui para completar os 6 cenários da matriz.
describe("SchoolTermSchema — validação de intervalo de datas (cenário 6 da matriz)", () => {
  it("rejeita um intervalo com endDate < startDate", () => {
    const result = SchoolTermSchema.safeParse({
      startDate: "2026-09-01",
      endDate: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });

  it("aceita um intervalo válido com endDate >= startDate", () => {
    const result = SchoolTermSchema.safeParse({
      startDate: "2026-08-01",
      endDate: "2026-09-01",
    });
    expect(result.success).toBe(true);
  });

  it("aceita um intervalo de um único dia (endDate === startDate)", () => {
    const result = SchoolTermSchema.safeParse({
      startDate: "2026-08-01",
      endDate: "2026-08-01",
    });
    expect(result.success).toBe(true);
  });
});
