"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { logger } from "@/lib/logger";
import {
  FatigueResponseSchema,
  type FatigueResponseInput,
} from "@/lib/schemas/fatigue";
import { calculateSrpeLoad, isSrpeInputValid } from "@/lib/readiness/srpe";
import { refreshSnapshotForSession } from "@/lib/readiness/snapshot";
import { requireStaffRole, getPlayerIdsForTeams } from "@/lib/actions/auth";
import { getSessionById } from "@/lib/actions/sessions";
import { requiresFatigueQuestionnaire } from "@/lib/schemas/sessions";

/**
 * writeFatigueResponseSideEffects — helper interno partilhado pelos dois caminhos de
 * submissão (self-serve e staff-mediado).
 *
 * Extraído de submitFatigueResponse (spec-staff-mediated-fatigue-questionnaire, loopback #1):
 * upsert de fatigue_responses, transição de presença, upsert de session_metrics, audit log,
 * refresh de readiness snapshot. Os passos 1-5 de submitFatigueResponse (Zod, auth, resolução
 * do próprio jogador, verificação player_id === player.id, processing_restricted) NÃO fazem
 * parte deste helper — mantêm-se bit-a-bit idênticos em submitFatigueResponse.
 *
 * @param actorId utilizador autenticado que executa a acção (jogador em 'self', staff em 'staff')
 * @param clubId club_id do JOGADOR-ALVO (isolamento multi-tenant da escrita)
 * @param via 'self' (o próprio jogador) | 'staff' (treinador em nome do jogador) — determina
 *   se a transição de presença sem_questionario→present é aplicada (só 'self' + phase 'pre')
 *   e é gravado em audit_logs.payload.via para distinguir autoria.
 */
async function writeFatigueResponseSideEffects(
  validated: FatigueResponseInput,
  actorId: string,
  clubId: string,
  via: "self" | "staff"
): Promise<Result<{ id: string }, AppError>> {
  const serviceRole = getServiceRoleClient();

  // Upsert com chave real de conflito UNIQUE(player_id, session_id, phase)
  // (constraint fatigue_responses_unique_phase, supabase/migrations/000200_fatigue_responses.sql).
  // NÃO usar 'id' — é um UUIDv7 gerado no cliente a cada carregamento de página, por isso
  // nunca coincide entre duas submissões distintas para o mesmo jogador/sessão/fase.
  // Reenviar/editar uma resposta já existente actualiza esta mesma linha (loopback #1).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceRole.from as any)("fatigue_responses").upsert(
    {
      id: validated.id,
      club_id: clubId,
      player_id: validated.player_id,
      session_id: validated.session_id,
      phase: validated.phase,
      dim_energy: validated.dim_energy,
      dim_focus: validated.dim_focus,
      dim_sleep: validated.dim_sleep,
      dim_soreness: validated.dim_soreness,
      dim_mood: validated.dim_mood,
      srpe_value: validated.srpe_value ?? null,
      muscle_pain_zones: validated.muscle_pain_zones ?? null,
      has_exams_this_week: validated.has_exams_this_week ?? null,
      submitted_via: validated.submitted_via,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "player_id,session_id,phase", ignoreDuplicates: false }
  );

  if (error) {
    logger.error("fatigue_response.upsert_failed", {
      player_id: validated.player_id,
      session_id: validated.session_id,
      phase: validated.phase,
      via,
      error: error.message,
    });
    return err({
      code: "internal",
      message: error.message ?? "Erro ao guardar resposta de fadiga",
    });
  }

  logger.info("fatigue_response.submitted", {
    player_id: validated.player_id,
    session_id: validated.session_id,
    phase: validated.phase,
    via,
  });

  // Transição automática de presença: sem_questionario → present (fire-and-forget).
  // Aplica-se APENAS a submissões self-serve na fase pré — uma submissão em modo staff
  // NUNCA altera o estado de presença (ausência é gerida exclusivamente via o ecrã de
  // presenças existente). Só actua se o estado actual for 'sem_questionario'.
  if (via === "self" && validated.phase === "pre") {
    void (async () => {
      try {
        const { error: attendanceErr } = await serviceRole
          .from("attendances")
          .update({ status: "present" })
          .eq("session_id", validated.session_id)
          .eq("player_id", validated.player_id)
          .eq("club_id", clubId)
          .eq("status", "sem_questionario");

        if (attendanceErr) {
          logger.warn("attendance.sem_questionario_transition_failed", {
            player_id: validated.player_id,
            session_id: validated.session_id,
            error: attendanceErr.message,
          });
        }
      } catch (e) {
        logger.warn("attendance.sem_questionario_transition_failed", {
          player_id: validated.player_id,
          session_id: validated.session_id,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    })();
  }

  // Upsert session_metrics (Story 5.1, FR33) — apenas fase 'post', incondicional a 'via'.
  // Operação secundária: erros são logados mas NÃO propagados — fatigue_responses já gravada.
  const srpeValue = validated.srpe_value;
  if (validated.phase === "post" && srpeValue != null) {
    const sessionId = validated.session_id;
    const playerId = validated.player_id;

    void (async () => {
      try {
        let session: { duration_min?: number | null } | null;
        try {
          const { data, error: sessionError } = await serviceRole
            .from("sessions")
            .select("duration_min")
            .eq("id", sessionId)
            .maybeSingle();

          if (sessionError) {
            logger.error("session_metrics.session_lookup_failed", {
              player_id: playerId,
              session_id: sessionId,
              error: sessionError.message,
            });
            return;
          }
          session = data;
        } catch (e) {
          logger.error("session_metrics.session_lookup_failed", {
            player_id: playerId,
            session_id: sessionId,
            error: e instanceof Error ? e.message : String(e),
          });
          return;
        }

        if (!session || session.duration_min == null) {
          logger.error("session_metrics.invalid_duration", {
            player_id: playerId,
            session_id: sessionId,
            error: "session.duration_min is null or undefined",
          });
          return;
        }

        if (!isSrpeInputValid(srpeValue, session.duration_min)) {
          logger.error("session_metrics.invalid_inputs", {
            player_id: playerId,
            session_id: sessionId,
            srpe_value: srpeValue,
            duration_min: session.duration_min,
            error: "inputs fail validation (srpe 1–10, duration 15–240)",
          });
          return;
        }

        const srpeLoad = calculateSrpeLoad(srpeValue, session.duration_min);

        const { error: smError } = await serviceRole
          .from("session_metrics")
          .upsert(
            {
              club_id: clubId,
              session_id: sessionId,
              player_id: playerId,
              srpe_value: srpeValue,
              duration_min: session.duration_min,
              computed_at: new Date().toISOString(),
            },
            { onConflict: "session_id,player_id", ignoreDuplicates: false }
          );

        if (smError) {
          logger.error("session_metrics.upsert_failed", {
            player_id: playerId,
            session_id: sessionId,
            error: smError.message,
          });
        } else {
          logger.info("session_metrics.upserted", {
            player_id: playerId,
            session_id: sessionId,
            srpe_value: srpeValue,
            duration_min: session.duration_min,
            srpe_load: srpeLoad,
          });
        }
      } catch (e) {
        logger.error("session_metrics.upsert_failed", {
          player_id: playerId,
          session_id: sessionId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  }

  // Fire-and-forget audit log (Story 3.11 + Decision #2). actor_id distingue autoria
  // (jogador em 'self', treinador em 'staff'); payload.via = mesma convenção de
  // withdrawConsentByStaff (spec-staff-mediated-consent-withdrawal.md).
  void (async () => {
    try {
      await serviceRole.from("audit_logs").insert({
        actor_id: actorId,
        action: "submitted_fatigue_response",
        target_kind: "fatigue_response",
        target_id: validated.player_id,
        club_id: clubId,
        payload: {
          session_id: validated.session_id,
          phase: validated.phase,
          submitted_via: validated.submitted_via,
          via,
        },
      });
    } catch (e) {
      logger.error("fatigue_response.audit_log_failed", {
        player_id: validated.player_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  })();

  // Fire-and-forget refresh de readiness snapshot (Story 5.3)
  void (async () => {
    try {
      await refreshSnapshotForSession(serviceRole, validated.session_id);
    } catch (e) {
      logger.error("readiness_snapshot.refresh_failed", {
        session_id: validated.session_id,
        player_id: validated.player_id,
        context: "writeFatigueResponseSideEffects after()",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  })();

  // O id é o UUIDv7 fornecido pelo cliente — idempotente por design (NFR48)
  return ok({ id: validated.id });
}

/**
 * submitFatigueResponse — Server Action idempotente para submissão de questionário de fadiga.
 *
 * - Valida payload via Zod (FatigueResponseSchema)
 * - Verifica autenticação e registo de jogador
 * - Verifica restrição de tratamento (RGPD Art. 18, Story 3.9)
 * - Upsert com client-generated UUIDv7 como chave de idempotência (NFR48, AR4)
 * - Submeter o mesmo id duas vezes é um no-op (ON CONFLICT (id) DO UPDATE)
 *
 * **Deduplicação por UUIDv7 (Story 4.4, AC #2):**
 * - O `id` é um UUIDv7 gerado no cliente e é a chave primária
 * - Chamadas repetidas com o mesmo UUID são idempotentes — o banco ignora segundas tentativas
 * - Crítico para offline-drain: se uma submissão é feita offline e depois retentada no drain,
 *   o servidor garante que existe apenas 1 row mesmo após múltiplas chamadas com o mesmo UUID
 * - Exemplo: enfileirar offline com UUID abc123 → drain retenta → servidor de-duplica → 1 row
 *
 * Usado em Story 4.2 (UI online) e Story 4.4 (offline-drain).
 */
export async function submitFatigueResponse(
  payload: FatigueResponseInput
): Promise<Result<{ id: string }, AppError>> {
  // 3.3.1 — Validação Zod
  const validated = FatigueResponseSchema.safeParse(payload);
  if (!validated.success) {
    return err({
      code: "validation",
      message:
        validated.error.issues[0]?.message ?? "Dados de fadiga inválidos",
      details: { issues: validated.error.issues },
    });
  }

  // 3.3.2 — Autenticação
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err({ code: "unauthorized", message: "Não autenticado" });
  }

  // 3.3.3 — Lookup do jogador pelo profile_id do utilizador autenticado
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, club_id, processing_restricted")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (playerError) {
    logger.error("fatigue_response.player_lookup_failed", {
      user_id: user.id,
      error: playerError.message,
    });
    return err({
      code: "internal",
      message: "Erro ao procurar registo de jogador",
    });
  }

  if (!player) {
    return err({
      code: "not_found",
      message: "Sem registo de jogador para este utilizador",
    });
  }

  // 3.3.4 — Verificar que o player_id do payload coincide com o do jogador autenticado
  if (validated.data.player_id !== player.id) {
    return err({
      code: "forbidden",
      message: "Não tens permissão para submeter respostas por outro jogador",
    });
  }

  // 3.3.5 — Verificar restrição de tratamento (RGPD Art. 18, Story 3.9)
  if (player.processing_restricted === true) {
    return err({
      code: "processing_restricted",
      message:
        "O tratamento dos teus dados está limitado. Não é possível registar respostas.",
    });
  }

  // 3.3.6+ — Delegar upsert + efeitos secundários ao helper partilhado (via: 'self')
  return writeFatigueResponseSideEffects(
    validated.data,
    user.id,
    player.club_id,
    "self"
  );
}

/**
 * submitFatigueResponseByStaff — permite a um membro do staff (coach/analyst) submeter,
 * em nome de um jogador da sua equipa, uma resposta ao questionário de fadiga (ou editar
 * uma já existente — ver writeFatigueResponseSideEffects/upsert na chave real).
 *
 * spec-staff-mediated-fatigue-questionnaire.md — guardas de defesa em profundidade
 * replicadas aqui mesmo já existindo na página host (AGENTS.md padrão #16 — comportamento
 * condicional por tipo/estado de sessão precisa de guarda em TODOS os pontos de entrada):
 * - requireStaffRole() + getPlayerIdsForTeams(): jogador tem de pertencer ao âmbito do staff
 * - jogador-alvo: club_id cruzado, archived_at IS NULL, processing_restricted
 * - sessão: requiresFatigueQuestionnaire(session.type) + estado da sessão phase-aware
 *   (cancelled sempre bloqueia; pre requer 'scheduled'; post aceita 'scheduled'/'completed')
 * - fase post: jogador não pode estar 'absent' nessa sessão (mirror exacto da guarda self-serve)
 *
 * Nunca toca em presença — chama o helper partilhado com via: 'staff', que por construção
 * ignora a transição sem_questionario→present nesse modo.
 */
export async function submitFatigueResponseByStaff(
  payload: FatigueResponseInput
): Promise<Result<{ id: string }, AppError>> {
  // Validação Zod (idêntica ao caminho self-serve)
  const validated = FatigueResponseSchema.safeParse(payload);
  if (!validated.success) {
    return err({
      code: "validation",
      message:
        validated.error.issues[0]?.message ?? "Dados de fadiga inválidos",
      details: { issues: validated.error.issues },
    });
  }

  // Autorização staff (coach/analyst) — mesmo padrão de readiness.ts
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId, teamIds } = authResult.data;

  // Jogador-alvo tem de pertencer ao âmbito de equipas do staff — not_found (não forbidden),
  // mesma convenção de getPlayerForStaffQuestionnaire: não revelar existência do recurso
  const playerIds = await getPlayerIdsForTeams(teamIds);
  if (!playerIds.includes(validated.data.player_id)) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const serviceRole = getServiceRoleClient();

  // Jogador-alvo: club_id cruzado (defesa em profundidade), não arquivado, sem restrição
  const { data: player, error: playerError } = await serviceRole
    .from("players")
    .select("id, club_id, archived_at, processing_restricted")
    .eq("id", validated.data.player_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (playerError) {
    logger.error("fatigue_response.staff_player_lookup_failed", {
      player_id: validated.data.player_id,
      error: playerError.message,
    });
    return err({ code: "internal", message: "Erro ao procurar jogador" });
  }

  if (!player || player.archived_at != null) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  if (player.processing_restricted === true) {
    return err({
      code: "processing_restricted",
      message:
        "O tratamento dos dados deste jogador está limitado. Não é possível apresentar ou registar respostas.",
    });
  }

  // Sessão: existe, tipo requer questionário de fadiga (defesa em profundidade — não confiar
  // apenas na guarda da página, AGENTS.md padrão #16)
  const sessionResult = await getSessionById(validated.data.session_id);
  if (!sessionResult.ok) return sessionResult;

  if (!requiresFatigueQuestionnaire(sessionResult.data.type)) {
    return err({
      code: "session_invalid",
      message: "Esta sessão não tem questionário de fadiga.",
    });
  }

  // Estado da sessão — mirror exacto da guarda self-serve
  // (/questionario/[sessionId]/[phase]/page.tsx, ~linhas 138-150)
  const isValidStatus =
    validated.data.phase === "post"
      ? sessionResult.data.status === "scheduled" ||
        sessionResult.data.status === "completed"
      : sessionResult.data.status === "scheduled";

  if (!isValidStatus) {
    const message =
      sessionResult.data.status === "cancelled"
        ? "Sessão cancelada — não é possível responder ao questionário"
        : validated.data.phase === "pre"
          ? "Sessão já concluída — o questionário pré-sessão só pode ser preenchido antes da sessão"
          : "Sessão inválida — não é possível responder ao questionário";
    return err({ code: "session_invalid", message });
  }

  // Fase post: bloquear se o jogador está marcado 'absent' nessa sessão
  // (mirror exacto da guarda de ausência self-serve, duplicada aqui como defesa em profundidade)
  if (validated.data.phase === "post") {
    const { data: attendance, error: attendanceError } = await serviceRole
      .from("attendances")
      .select("status")
      .eq("session_id", validated.data.session_id)
      .eq("player_id", validated.data.player_id)
      .eq("club_id", clubId)
      .maybeSingle();

    if (attendanceError) {
      logger.error("fatigue_response.staff_attendance_lookup_failed", {
        player_id: validated.data.player_id,
        session_id: validated.data.session_id,
        error: attendanceError.message,
      });
      return err({ code: "internal", message: "Erro ao verificar presença" });
    }

    if (attendance?.status === "absent") {
      return err({
        code: "player_absent",
        message:
          "Este jogador declarou ausência nesta sessão — o questionário pós-sessão não está disponível.",
      });
    }
  }

  return writeFatigueResponseSideEffects(
    validated.data,
    userId,
    clubId,
    "staff"
  );
}

/**
 * getSessionFatigueStatus — Verifica se o jogador autenticado já respondeu ao questionário
 * de fadiga para uma dada sessão (pré e/ou pós-sessão).
 *
 * Retorna apenas booleans — nunca devolve dados de saúde (NFR21).
 * RLS garante que o player vê apenas os seus próprios rows.
 * Defence-in-depth: filtro explícito por player_id.
 *
 * AC #2 — Story 4.9
 */
export async function getSessionFatigueStatus(
  sessionId: string
): Promise<Result<{ pre: boolean; post: boolean }, AppError>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  // Implicit role guard: apenas jogadores têm registo em players.
  // Staff/analistas sem registo retornam ok() por graceful degradation — esta função
  // retorna apenas booleans (sem dados de saúde, NFR21) e é chamada exclusivamente
  // de rotas da zona (player), onde o role já foi verificado upstream.
  if (!player) return ok({ pre: false, post: false });

  // eslint-disable-next-line custom/no-direct-health-data-read -- player reads own boolean status only; no metric derived
  const { data: rows, error: rowsError } = await supabase
    .from("fatigue_responses")
    .select("phase")
    .eq("session_id", sessionId)
    .eq("player_id", player.id);

  if (rowsError) {
    return err({ code: "db_error", message: rowsError.message });
  }

  const phases = new Set((rows ?? []).map((r) => r.phase));
  return ok({ pre: phases.has("pre"), post: phases.has("post") });
}
