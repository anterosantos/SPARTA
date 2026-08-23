"use client";

import { useMemo, useState } from "react";
import { X, Triangle, Download } from "lucide-react";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  STATUS_ICON_COLOR,
  attendanceMatrixKey,
} from "@/lib/attendance-status";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/schemas/attendances";
import { SESSION_TYPE_COLORS } from "@/lib/constants/session-colors";
import type { SessionType } from "@/lib/schemas/sessions";
import { useDarkMode } from "@/hooks/useDarkMode";
import { Button } from "@/components/ui/button";
import { exportAttendanceMatrixPdf } from "@/lib/utils/export";
import type {
  AttendanceMatrixPlayer,
  AttendanceMatrixSession,
} from "@/lib/actions/attendance-matrix";

const TZ = "Europe/Lisbon";

/** Agrupa os 6 tipos de sessão em 4 filtros, como pedido: Treino / Jogo (jogo+amigável) /
 * Palestra / Outros (médico+outros). A cor de cada botão vem do primeiro tipo do grupo,
 * reutilizando SESSION_TYPE_COLORS já usado no calendário — sem inventar paleta nova. */
const TYPE_FILTER_GROUPS: { key: string; label: string; types: SessionType[] }[] = [
  { key: "training", label: "Treino", types: ["training"] },
  { key: "match", label: "Jogo", types: ["match", "friendly"] },
  { key: "lecture", label: "Palestra", types: ["lecture"] },
  { key: "other", label: "Outros", types: ["medical", "other"] },
];

/** Presente = círculo; Ausente = X; Atrasado = triângulo; restantes = quadrado.
 * Todos herdam a mesma cor de STATUS_COLOR/STATUS_ICON_COLOR — só a forma muda. */
function StatusMark({ status }: { status: AttendanceStatus }) {
  if (status === "absent") {
    return <X className={`h-5 w-5 ${STATUS_ICON_COLOR[status]}`} strokeWidth={3} aria-hidden="true" />;
  }
  if (status === "late") {
    return (
      <Triangle
        className={`h-5 w-5 ${STATUS_ICON_COLOR[status]}`}
        fill="currentColor"
        strokeWidth={0}
        aria-hidden="true"
      />
    );
  }
  const shape = status === "present" ? "rounded-full" : "rounded-sm";
  return <span className={`inline-block h-6 w-6 ${shape} ${STATUS_COLOR[status]}`} aria-hidden="true" />;
}

interface AttendanceMatrixProps {
  players: AttendanceMatrixPlayer[];
  sessions: AttendanceMatrixSession[];
  statusMap: Record<string, AttendanceStatus>;
}

function formatSessionHeader(
  scheduledAt: string
): { weekday: string; dateLabel: string; timeLabel: string } {
  const date = new Date(scheduledAt);
  const weekday = date.toLocaleDateString("pt-PT", {
    weekday: "short",
    timeZone: TZ,
  });
  const dateLabel = date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TZ,
  });
  const timeLabel = date.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  });
  // Só remover um "." final (ex: "ter." -> "ter") — não qualquer ocorrência no meio da string.
  return { weekday: weekday.replace(/\.$/, ""), dateLabel, timeLabel };
}

export function AttendanceMatrix({
  players,
  sessions,
  statusMap,
}: AttendanceMatrixProps) {
  const isDark = useDarkMode();

  const [activeTypeGroups, setActiveTypeGroups] = useState<Set<string>>(
    () => new Set(TYPE_FILTER_GROUPS.map((g) => g.key))
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<AttendanceStatus>>(
    () => new Set(ATTENDANCE_STATUSES)
  );

  function toggleTypeGroup(key: string) {
    setActiveTypeGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleStatus(status: AttendanceStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const group = TYPE_FILTER_GROUPS.find((g) => g.types.includes(session.type as SessionType));
        return group ? activeTypeGroups.has(group.key) : activeTypeGroups.size === TYPE_FILTER_GROUPS.length;
      }),
    [sessions, activeTypeGroups]
  );

  const filteredPlayers = useMemo(
    () =>
      players.filter((player) =>
        filteredSessions.some((session) => {
          const status = statusMap[attendanceMatrixKey(player.id, session.id)] ?? "sem_questionario";
          return activeStatuses.has(status);
        })
      ),
    [players, filteredSessions, statusMap, activeStatuses]
  );

  const handleExportPdf = () => {
    if (filteredPlayers.length === 0 || filteredSessions.length === 0) return;
    exportAttendanceMatrixPdf(filteredPlayers, filteredSessions, statusMap);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportPdf}
          disabled={filteredPlayers.length === 0 || filteredSessions.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Exportar PDF
        </Button>
      </div>

      {/* Filtro por tipo de sessão */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Tipo de sessão</p>
        <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
          {TYPE_FILTER_GROUPS.map((group) => {
            const active = activeTypeGroups.has(group.key);
            const color = SESSION_TYPE_COLORS[group.types[0]!];
            const bgColor = isDark ? color.bgDark : color.bg;
            return (
              <li key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleTypeGroup(group.key)}
                  aria-pressed={active}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-opacity"
                  style={{ opacity: active ? 1 : 0.35 }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: bgColor }}
                    aria-hidden="true"
                  />
                  {group.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Filtro por estado — esconde jogadores sem nenhuma célula com o estado seleccionado
          (dentro das sessões já filtradas por tipo acima). */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Estado</p>
        <ul className="flex flex-wrap gap-3 list-none p-0 m-0" aria-label="Filtro e legenda de estados de presença">
          {ATTENDANCE_STATUSES.map((status) => {
            const active = activeStatuses.has(status);
            return (
              <li key={status}>
                <button
                  type="button"
                  onClick={() => toggleStatus(status)}
                  aria-pressed={active}
                  className="inline-flex items-center gap-1.5 transition-opacity"
                  style={{ opacity: active ? 1 : 0.35 }}
                >
                  <StatusMark status={status} />
                  <span className="text-xs font-medium text-foreground">{STATUS_LABEL[status]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Grelha */}
      {filteredSessions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Sem sessões deste tipo neste período.
        </p>
      ) : filteredPlayers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum jogador com o(s) estado(s) selecionado(s).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-background border-b border-r border-border px-3 py-2 text-left font-semibold text-foreground min-w-[10rem]"
                >
                  Jogador
                </th>
                {filteredSessions.map((session) => {
                  const { weekday, dateLabel, timeLabel } = formatSessionHeader(session.scheduledAt);
                  return (
                    <th
                      key={session.id}
                      scope="col"
                      className="border-b border-border px-2 py-2 text-center font-medium text-muted-foreground whitespace-nowrap"
                    >
                      <span className="block text-[10px] uppercase">{weekday}</span>
                      <span className="block">{dateLabel}</span>
                      <span className="block text-[10px]">{timeLabel}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr key={player.id} className="border-b border-border last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-background border-r border-border px-3 py-2 text-left font-medium text-foreground whitespace-nowrap"
                  >
                    <span className="text-muted-foreground tabular-nums mr-2">
                      {player.jerseyNum ?? "—"}
                    </span>
                    {player.fullName}
                    {player.position && (
                      <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                        {player.position}
                      </span>
                    )}
                  </th>
                  {filteredSessions.map((session) => {
                    const status =
                      statusMap[attendanceMatrixKey(player.id, session.id)] ?? "sem_questionario";
                    return (
                      <td key={session.id} className="px-2 py-2 text-center">
                        <span
                          title={STATUS_LABEL[status]}
                          role="img"
                          aria-label={`${player.fullName} — ${STATUS_LABEL[status]}`}
                          className="inline-flex items-center justify-center h-6 w-6"
                        >
                          <StatusMark status={status} />
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
