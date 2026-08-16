import { z } from "zod";

/**
 * HH:mm nullable — hora de saída da escola num dia da semana.
 * null = sem aulas / não aplicável nesse dia (FR — spec-horario-saida-risco-atraso).
 */
const SchoolTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (formato HH:mm)")
  .nullable();

/**
 * WeeklyScheduleSchema — horário semanal de saída da escola (Segunda a Sexta).
 * 5× HH:mm nullable, um por dia útil.
 * Refine: pelo menos um dia deve ter hora definida (não pode ser tudo null).
 */
export const WeeklyScheduleSchema = z
  .object({
    mon_time: SchoolTimeSchema,
    tue_time: SchoolTimeSchema,
    wed_time: SchoolTimeSchema,
    thu_time: SchoolTimeSchema,
    fri_time: SchoolTimeSchema,
  })
  .refine((data) => Object.values(data).some((time) => time !== null), {
    message: "Adiciona a hora de saída para pelo menos um dia da semana",
  });

export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>;

/**
 * SchoolTermSchema — um intervalo de datas (período letivo) em que o horário é válido.
 * Refine: endDate >= startDate (I/O Matrix — "Intervalo de datas inválido").
 */
export const SchoolTermSchema = z
  .object({
    startDate: z.string().date("Data de início inválida"),
    endDate: z.string().date("Data de fim inválida"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Data de fim deve ser igual ou posterior à data de início",
    path: ["endDate"],
  });

export type SchoolTerm = z.infer<typeof SchoolTermSchema>;

/**
 * SaveSchoolScheduleInputSchema — payload completo submetido pelo formulário
 * `/configuracoes/horario-saida`: horário semanal + pelo menos um intervalo letivo.
 * Refine: intervalos não podem sobrepor-se (no overlapping date ranges).
 */
export const SaveSchoolScheduleInputSchema = z
  .object({
    weekly: WeeklyScheduleSchema,
    terms: z.array(SchoolTermSchema).min(1, "Adiciona pelo menos um intervalo letivo"),
  })
  .refine(
    (data) => {
      const sorted = [...data.terms].sort((a, b) => a.startDate.localeCompare(b.startDate));
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i]!.endDate >= sorted[i + 1]!.startDate) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Intervalos letivos não podem sobrepor-se",
      path: ["terms"],
    }
  );

export type SaveSchoolScheduleInput = z.infer<typeof SaveSchoolScheduleInputSchema>;
