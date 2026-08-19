import { Metadata } from "next";
import { Grid3x3, Users, CalendarX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getAttendanceMatrixData } from "@/lib/actions/attendance-matrix";
import { AttendanceMatrix } from "./AttendanceMatrix";

export const metadata: Metadata = {
  title: "Matriz de Presenças — SPARTA",
};

export default async function EquipaPresencasPage() {
  const result = await getAttendanceMatrixData();

  if (!result.ok) {
    return (
      <div className="container py-8 sm:py-12">
        <EmptyState
          icon={
            <Grid3x3
              className="h-8 w-8 text-muted-foreground"
              aria-hidden="true"
            />
          }
          title="Erro ao carregar dados"
          description={result.error.message}
        />
      </div>
    );
  }

  const { players, sessions, statusMap } = result.data;

  return (
    <div className="container py-8 sm:py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Matriz de Presenças
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Assiduidade da equipa nas últimas 8 semanas — jogadores em linhas,
            sessões em colunas
          </p>
        </div>

        {players.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
            title="Sem jogadores atribuídos às tuas equipas"
            description="Não há jogadores no âmbito das equipas que treinas."
          />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
            title="Sem sessões neste período"
            description="Não há sessões registadas nas últimas 8 semanas."
          />
        ) : (
          <AttendanceMatrix
            players={players}
            sessions={sessions}
            statusMap={statusMap}
          />
        )}
      </div>
    </div>
  );
}
