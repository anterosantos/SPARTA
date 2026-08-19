import type { AttendanceStatus } from "@/lib/schemas/attendances";

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  sem_questionario: "Sem Questionário",
  present: "Presente",
  absent: "Ausente",
  late: "Atrasado",
  injured: "Lesionado",
  excused: "Justificado",
};

export const STATUS_COLOR: Record<AttendanceStatus, string> = {
  sem_questionario: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
  late: "bg-yellow-100 text-yellow-800",
  injured: "bg-orange-100 text-orange-800",
  excused: "bg-blue-100 text-blue-800",
};

/** Chave composta partilhada entre quem constrói o statusMap (attendance-matrix.ts) e
 * quem o consome (AttendanceMatrix.tsx) — evita duplicar o template string nos dois lados. */
export function attendanceMatrixKey(playerId: string, sessionId: string): string {
  return `${playerId}:${sessionId}`;
}
