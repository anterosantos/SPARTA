"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Users, Video, Gauge, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CancelSessionDialog } from "@/components/dialogs/cancel-session-dialog";
import type { SessionType } from "@/lib/schemas/sessions";

interface SessionDetailActionsProps {
  sessionId: string;
  sessionType: SessionType;
  isScheduled: boolean;
  isCompleted: boolean;
  isCoach: boolean;
  isAnalyst: boolean;
}

export function SessionDetailActions({
  sessionId,
  sessionType,
  isScheduled,
  isCompleted,
  isCoach,
  isAnalyst,
}: SessionDetailActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const isMatchOrFriendly = sessionType === "match" || sessionType === "friendly";

  return (
    <>
      <div className="flex flex-col gap-3 pt-4">
        {/* Captura de eventos — staff (coach + analyst) para jogos agendados */}
        {isMatchOrFriendly && isScheduled && (
          <Button asChild variant="primary" className="w-full justify-start gap-2">
            <Link href={`/sessoes/${sessionId}/captura`}>
              <Video className="h-4 w-4" />
              Captura de eventos
            </Link>
          </Button>
        )}

        {/* Presenças — staff (coach + analyst), todos os tipos de sessão */}
        <Button asChild variant="ghost" className="w-full justify-start gap-2">
          <Link href={`/sessoes/${sessionId}/presencas`}>
            <ClipboardList className="h-4 w-4" />
            Presenças
          </Link>
        </Button>

        {/* Registar sRPE — staff (coach + analyst), todos os tipos de sessão */}
        <Button asChild variant="ghost" className="w-full justify-start gap-2">
          <Link href={`/sessoes/${sessionId}/srpe`}>
            <Gauge className="h-4 w-4" />
            Registar sRPE
          </Link>
        </Button>

        {/* Convocatória — coach edita, analyst só consulta (a página já trata
            readOnly={role === "analyst"}; aqui só garantimos que o link existe
            para ambos, não só para coach) */}
        {isMatchOrFriendly && (isCoach || isAnalyst) && (
          <Button asChild variant="ghost" className="w-full justify-start gap-2">
            <Link href={`/sessoes/${sessionId}/convocatoria`}>
              <Users className="h-4 w-4" />
              Convocatória
            </Link>
          </Button>
        )}

        {/* Resumo — estatísticas consolidadas (placar, golos, cartões, minutos por
            jogador). Sempre disponível para jogos/amigáveis, staff (coach + analyst);
            destaque (primary) quando o jogo já foi fechado. */}
        {isMatchOrFriendly && (isCoach || isAnalyst) && (
          <Button
            asChild
            variant={isCompleted ? "primary" : "ghost"}
            className="w-full justify-start gap-2"
          >
            <Link href={`/sessoes/${sessionId}/resumo`}>
              <ListOrdered className="h-4 w-4" />
              Resumo
            </Link>
          </Button>
        )}

        {/* Editar e cancelar — coach apenas, sessão agendada */}
        {isCoach && isScheduled && (
          <div className="flex gap-2">
            <Button asChild variant="ghost" className="flex-1">
              <Link href={`/sessoes/${sessionId}/editar`}>Editar</Link>
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => setCancelOpen(true)}
            >
              Cancelar sessão
            </Button>
          </div>
        )}
      </div>

      <CancelSessionDialog
        sessionId={sessionId}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
