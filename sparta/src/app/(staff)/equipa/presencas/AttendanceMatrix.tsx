import { STATUS_LABEL, STATUS_COLOR, attendanceMatrixKey } from "@/lib/attendance-status";
import { ATTENDANCE_STATUSES } from "@/lib/schemas/attendances";
import type {
  AttendanceMatrixPlayer,
  AttendanceMatrixSession,
} from "@/lib/actions/attendance-matrix";
import type { AttendanceStatus } from "@/lib/schemas/attendances";

const TZ = "Europe/Lisbon";

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
  return (
    <div className="space-y-4">
      {/* Legenda */}
      <ul className="flex flex-wrap gap-2 list-none p-0 m-0" aria-label="Legenda de estados de presença">
        {ATTENDANCE_STATUSES.map((status) => (
          <li key={status}>
            <span
              className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[status]}`}
            >
              {STATUS_LABEL[status]}
            </span>
          </li>
        ))}
      </ul>

      {/* Grelha */}
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
              {sessions.map((session) => {
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
            {players.map((player) => (
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
                {sessions.map((session) => {
                  const status =
                    statusMap[attendanceMatrixKey(player.id, session.id)] ?? "sem_questionario";
                  return (
                    <td key={session.id} className="px-2 py-2 text-center">
                      <span
                        title={STATUS_LABEL[status]}
                        aria-label={`${player.fullName} — ${STATUS_LABEL[status]}`}
                        className={`inline-block h-6 w-6 rounded-full ${STATUS_COLOR[status]}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
