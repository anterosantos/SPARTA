/**
 * Página host do questionário de fadiga staff-mediado — spec-staff-mediated-fatigue-questionnaire.md
 *
 * Rota: /prontidao/questionarios/[playerId]/[sessionId]/[phase]
 * Grupo: (staff)
 *
 * Réplica das guardas da página self-serve (/questionario/[sessionId]/[phase]/page.tsx),
 * mas para um jogador-alvo escolhido pelo staff em vez do próprio jogador autenticado:
 * (a) guarda de tipo de sessão (requiresFatigueQuestionnaire)
 * (b) guarda de estado da sessão (cancelled sempre bloqueia; pre requer 'scheduled';
 *     post aceita 'scheduled'/'completed')
 * (c) guarda de ausência (fase post bloqueada se attendance.status === 'absent')
 *
 * Nota sobre params: Next.js 15 usa Promise<Params> — sempre await params.
 */

import { notFound, redirect } from "next/navigation";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { FatigueQuestionnaire } from "@/components/ui/fatigue-questionnaire";
import { requireStaffRole, getPlayerIdsForTeams } from "@/lib/actions/auth";
import { getSessionById } from "@/lib/actions/sessions";
import { requiresFatigueQuestionnaire } from "@/lib/schemas/sessions";
import {
  getPlayerForStaffQuestionnaire,
  getPlayerAttendanceStatusForStaff,
  getExistingFatigueResponseForStaff,
} from "@/lib/actions/fatigue-staff";

export const dynamic = "force-dynamic";

type Params = { playerId: string; sessionId: string; phase: string };

// Mesmo padrão de /questionario/[sessionId]/[phase]/page.tsx
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ErrorPage({
  title,
  message,
  backHref,
}: {
  title: string;
  message: string;
  backHref: string;
}) {
  return (
    <>
      <StickyHeader title={title} backHref={backHref} />
      <main id="main-content">
        <div className="px-4 py-6 sm:px-6">
          <p className="text-red-600 font-mono text-sm">{message}</p>
        </div>
      </main>
    </>
  );
}

export default async function StaffQuestionnairePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { playerId, sessionId, phase } = await params;

  // Guard: phase
  if (phase !== "pre" && phase !== "post") notFound();

  // Guard: formato UUID (mirror do self-serve)
  if (!UUID_REGEX.test(playerId) || !UUID_REGEX.test(sessionId)) notFound();

  const backHref = `/prontidao/questionarios?sessionId=${sessionId}`;

  // Autorização staff — distinguir "não autenticado" (login) de "sem permissão"
  // (área staff-only, 404 para não revelar a existência da rota a não-staff) e de
  // eventuais erros internos genuínos (mostrados como erro real).
  const authResult = await requireStaffRole();
  if (!authResult.ok) {
    if (authResult.error.code === "unauthorized") redirect("/login");
    notFound();
  }
  const { teamIds } = authResult.data;

  const playerIds = await getPlayerIdsForTeams(teamIds);
  if (!playerIds.includes(playerId)) notFound();

  // Jogador-alvo — PRIMEIRA leitura de dados: confirma âmbito, não arquivado, e bloqueia
  // imediatamente se processing_restricted, ANTES de qualquer tentativa de pré-preencher
  // dados de bem-estar (loopback #2).
  const playerResult = await getPlayerForStaffQuestionnaire(playerId);
  if (!playerResult.ok) {
    if (playerResult.error.code === "unauthorized") redirect("/login");
    if (playerResult.error.code === "not_found") notFound();
    if (playerResult.error.code === "processing_restricted") {
      return (
        <ErrorPage
          title="Questionário indisponível"
          message={playerResult.error.message}
          backHref={backHref}
        />
      );
    }
    return (
      <ErrorPage
        title="Erro"
        message={playerResult.error.message ?? "Erro ao carregar jogador"}
        backHref={backHref}
      />
    );
  }

  const player = playerResult.data;

  // Derivar grupo etário para adaptação linguística (mesmo critério do self-serve)
  const ageGroup: "senior" | "u14" =
    player.ageGroup === "u14" || player.ageGroup === "u15" ? "u14" : "senior";

  // Sessão: existe, pertence ao clube (via getSessionById), tipo requer questionário
  const sessionResult = await getSessionById(sessionId);
  if (!sessionResult.ok) {
    return (
      <ErrorPage
        title="Erro"
        message={sessionResult.error.message ?? "Erro ao carregar sessão"}
        backHref={backHref}
      />
    );
  }

  if (!requiresFatigueQuestionnaire(sessionResult.data.type)) {
    return (
      <ErrorPage
        title="Erro"
        message="Esta sessão não tem questionário de fadiga."
        backHref={backHref}
      />
    );
  }

  // Estado da sessão — mirror exacto da guarda self-serve
  // (/questionario/[sessionId]/[phase]/page.tsx, ~linhas 138-150)
  const isValidStatus =
    phase === "post"
      ? sessionResult.data.status === "scheduled" ||
        sessionResult.data.status === "completed"
      : sessionResult.data.status === "scheduled";

  if (!isValidStatus) {
    const message =
      sessionResult.data.status === "cancelled"
        ? "Sessão cancelada — não é possível responder ao questionário"
        : phase === "pre"
          ? "Sessão já concluída — o questionário pré-sessão só pode ser preenchido antes da sessão"
          : "Sessão inválida — não é possível responder ao questionário";
    return <ErrorPage title="Erro" message={message} backHref={backHref} />;
  }

  // Ausência — bloqueia a fase post (mesma mensagem do fluxo self-serve, adaptada para
  // o staff estar a ler sobre outro jogador). Falha a ler o estado de presença falha
  // FECHADA (mostra erro) em vez de assumir "não ausente" — mesma postura de
  // submitFatigueResponseByStaff, que também rejeita em caso de erro nesta leitura.
  if (phase === "post") {
    const attendanceResult = await getPlayerAttendanceStatusForStaff(
      playerId,
      sessionId
    );
    if (!attendanceResult.ok) {
      return (
        <ErrorPage
          title="Erro"
          message={attendanceResult.error.message ?? "Erro ao verificar presença"}
          backHref={backHref}
        />
      );
    }

    if (attendanceResult.data === "absent") {
      return (
        <ErrorPage
          title="Erro"
          message={`${player.fullName} declarou ausência nesta sessão — o questionário pós-sessão não está disponível.`}
          backHref={backHref}
        />
      );
    }
  }

  // Resposta existente (se houver) para pré-preencher em edição — só chega aqui depois
  // de confirmado que o jogador não tem processing_restricted. Uma falha genuína aqui
  // mostra erro em vez de prosseguir com formulário em branco — caso contrário o staff
  // poderia sobrescrever silenciosamente uma resposta real já existente sem saber que existia.
  const existingResult = await getExistingFatigueResponseForStaff(
    playerId,
    sessionId,
    phase
  );
  if (!existingResult.ok) {
    return (
      <ErrorPage
        title="Erro"
        message={existingResult.error.message ?? "Erro ao carregar resposta existente"}
        backHref={backHref}
      />
    );
  }
  const existing = existingResult.data;

  const session = sessionResult.data;

  return (
    <>
      <StickyHeader
        title={`Questionário — ${phase === "pre" ? "Pré" : "Pós"} · ${player.fullName}`}
        backHref={backHref}
      />
      <main id="main-content">
        <div className="px-4 py-6 sm:px-6">
          <FatigueQuestionnaire
            sessionId={sessionId}
            sessionType={session.type}
            sessionDate={session.scheduled_at}
            phase={phase}
            playerId={playerId}
            ageGroup={ageGroup}
            mode="staff"
            redirectOnDismiss={backHref}
            initialValues={existing ?? undefined}
          />
        </div>
      </main>
    </>
  );
}
