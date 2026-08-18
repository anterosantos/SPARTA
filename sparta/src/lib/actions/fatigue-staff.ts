"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { auditedRead } from "@/lib/data/audited";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { requireStaffRole, getPlayerIdsForTeams } from "@/lib/actions/auth";
import { getSessionById } from "@/lib/actions/sessions";
import { requiresFatigueQuestionnaire } from "@/lib/schemas/sessions";
import type { MusclePainZone } from "@/lib/schemas/fatigue";

export interface FatigueResponse {
  id: string;
  player_id: string;
  session_id: string;
  phase: string;
  dim_energy: number;
  dim_focus: number;
  dim_sleep: number;
  dim_soreness: number;
  dim_mood: number;
  srpe_value: number | null;
  submitted_at: string;
  submitted_via: string;
  // Sprint 1.5 — bem-estar (T1.5.1)
  muscle_pain_zones: string[] | null;
  has_exams_this_week: boolean | null;
}

export interface SessionInfo {
  id: string;
  type: string;
  scheduled_at: string;
}

export interface FatigueDataResult {
  responses: FatigueResponse[];
  sessions: Record<string, SessionInfo>;
  playerName: string;
  playerId: string;
}

const STAFF_ROLES = ["coach", "analyst"] as const;
const DURATION_DAYS = 28;

/**
 * Reads 28 days of fatigue responses for a player, staff-only.
 *
 * - Validates that the caller is staff (coach/analyst) of the same club
 * - Validates player belongs to the same club (AC #1, FR25, FR50)
 * - Uses auditedRead() for automatic audit logging (AC #2, Story 3.11)
 * - Returns 404 err when player not found (avoids revealing resource existence)
 */
export async function getPlayerFatigueData(
  playerId: string
): Promise<Result<FatigueDataResult, AppError>> {
  // Validate input
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err({ code: "unauthorized", message: "Não autenticado" });
  }

  // Validate staff role (AC #1)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !(STAFF_ROLES as readonly string[]).includes(profile.role ?? "")) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // Validate club_id exists
  if (!profile.club_id) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // Validate player belongs to same club (AC #1 — club_id match)
  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, club_id")
    .eq("id", playerId)
    .eq("club_id", profile.club_id)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // Validate player is in one of the staff's assigned teams — usa getPlayerIdsForTeams()
  // (mesmo padrão de getPlayer() em players.ts). Correção: a versão anterior usava
  // .maybeSingle() numa query team_players filtrada só por team_id+player_id, que falha
  // silenciosamente (PGRST116, erro descartado) quando o jogador pertence a mais do que
  // uma equipa do mesmo treinador — devolvia sempre not_found nesse caso, mesmo com acesso
  // legítimo. getPlayerIdsForTeams() busca a lista completa e testa com .includes(), imune
  // a múltiplas linhas.
  const serviceRoleForTeams = getServiceRoleClient();
  const { data: teamCoaches } = await serviceRoleForTeams
    .from("team_coaches")
    .select("team_id")
    .eq("profile_id", user.id)
    .eq("is_archived", false);
  const teamIds = (teamCoaches ?? []).map((tc: { team_id: string }) => tc.team_id);

  if (teamIds.length === 0) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const playerIds = await getPlayerIdsForTeams(teamIds);
  if (!playerIds.includes(playerId)) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // 28-day cutoff (UTC, consistent with DB timestamps) — precise ISO calculation
  const since = new Date(Date.now() - DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Query via auditedRead() — auto-inserts audit_logs fire-and-forget (AC #2)
  // actorId and clubId resolved here (outside after()) — cookies() not allowed inside after()
  let responses: FatigueResponse[] = [];
  try {
    responses = await auditedRead<FatigueResponse[]>(
      {
        action: "fatigue.staff_read",
        targetKind: "fatigue_responses",
        targetId: playerId,
        actorId: user.id,
        clubId: profile.club_id,
        payload: {
          duration_days: DURATION_DAYS,
          response_count: 0,
        },
      },
      async () => {
        // Service role bypasses RLS — application-level security already enforced:
        // 1. Caller authenticated (getUser above)
        // 2. Caller is coach/analyst of profile.club_id (role check above)
        // 3. Player belongs to profile.club_id (player lookup above)
        // Explicit club_id + player_id filters maintain data isolation.
        const serviceRole = getServiceRoleClient();
        // eslint-disable-next-line custom/no-direct-health-data-read -- query is legitimately wrapped in auditedRead()
        const { data, error } = await serviceRole
          .from("fatigue_responses")
          .select(
            "id, player_id, session_id, phase, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood, srpe_value, submitted_at, submitted_via, muscle_pain_zones, has_exams_this_week"
          )
          .eq("player_id", playerId)
          .eq("club_id", profile.club_id)
          .gte("submitted_at", since.toISOString())
          .order("submitted_at", { ascending: false });

        if (error) throw error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data ?? []) as any as FatigueResponse[];
      }
    );
  } catch {
    return err({ code: "internal", message: "Erro ao carregar respostas de fadiga" });
  }

  // Fetch session metadata for all unique session_ids (graceful fallback if session deleted)
  const sessionIds = [...new Set(responses.map((r) => r.session_id))];
  let sessionsMap: Record<string, SessionInfo> = {};

  if (sessionIds.length > 0) {
    const serviceRoleForSessions = getServiceRoleClient();
    const { data: sessions } = await serviceRoleForSessions
      .from("sessions")
      .select("id, type, scheduled_at")
      .in("id", sessionIds);

    sessionsMap = (sessions ?? []).reduce<Record<string, SessionInfo>>((acc, s) => {
      acc[s.id] = { id: s.id, type: s.type, scheduled_at: s.scheduled_at };
      return acc;
    }, {});
  }

  return ok({
    responses,
    sessions: sessionsMap,
    playerName: player.full_name,
    playerId: player.id,
  });
}

// =============================================================================
// spec-staff-mediated-fatigue-questionnaire.md — leituras de suporte à
// submissão de questionário de fadiga em nome de um jogador pelo staff.
// =============================================================================

export interface QuestionnaireListEntry {
  playerId: string;
  fullName: string;
  jerseyNum: number | null;
  answeredPre: boolean;
  answeredPost: boolean;
}

export interface QuestionnaireEntryListResult {
  requiresQuestionnaire: boolean;
  /** Mensagem a mostrar quando requiresQuestionnaire=false (tipo de sessão OU sessão cancelada). */
  blockedMessage?: string;
  entries: QuestionnaireListEntry[];
}

/**
 * getQuestionnaireEntryList — Lista de jogadores do âmbito do staff para uma sessão,
 * indicando se já responderam às fases pré/pós (para o indicador ✓ na lista).
 *
 * - sessionId vazio/whitespace → erro 'validation' (não 'not_found')
 * - requireStaffRole() + getPlayerIdsForTeams(): apenas jogadores das equipas do staff
 * - Sessões que não requerem questionário (Palestra/Médico/Outros) → requiresQuestionnaire: false
 * - players e fatigue_responses filtrados por club_id (defesa em profundidade, mesmo
 *   padrão de getPlayerFatigueData) e archived_at IS NULL
 * - fatigue_responses lido apenas para derivar booleans (answeredPre/answeredPost) —
 *   nunca devolve valores de dimensões, por isso não passa por auditedRead()/health-data lint
 *   (mesmo padrão de getSessionFatigueStatus em fatigue.ts)
 */
export async function getQuestionnaireEntryList(
  sessionId: string
): Promise<Result<QuestionnaireEntryListResult, AppError>> {
  if (!sessionId?.trim()) {
    return err({ code: "validation", message: "sessionId é obrigatório" });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId, teamIds } = authResult.data;

  const sessionResult = await getSessionById(sessionId);
  if (!sessionResult.ok) return sessionResult;

  if (!requiresFatigueQuestionnaire(sessionResult.data.type)) {
    return ok({
      requiresQuestionnaire: false,
      blockedMessage: "Esta sessão não tem questionário de fadiga.",
      entries: [],
    });
  }

  // Sessão cancelada bloqueia ambas as fases — refletir isto já na lista, em vez de só
  // ao clicar num jogador (loopback #3: a guarda de estado existe na página/ação, mas a
  // lista continuava a mostrar botões clicáveis para um beco sem saída).
  if (sessionResult.data.status === "cancelled") {
    return ok({
      requiresQuestionnaire: false,
      blockedMessage: "Sessão cancelada — não é possível responder ao questionário.",
      entries: [],
    });
  }

  const playerIds = await getPlayerIdsForTeams(teamIds);
  if (playerIds.length === 0) {
    return ok({ requiresQuestionnaire: true, entries: [] });
  }

  const serviceRole = getServiceRoleClient();

  const { data: players, error: playersError } = await serviceRole
    .from("players")
    .select("id, full_name, jersey_num")
    .in("id", playerIds)
    .eq("club_id", clubId)
    .is("archived_at", null);

  if (playersError) {
    return err({ code: "internal", message: "Erro ao carregar jogadores" });
  }

  // eslint-disable-next-line custom/no-direct-health-data-read -- boolean-only derivation (answered/not); no dimension values read, mirrors getSessionFatigueStatus
  const { data: responses, error: responsesError } = await serviceRole
    .from("fatigue_responses")
    .select("player_id, phase")
    .eq("session_id", sessionId)
    .eq("club_id", clubId)
    .in("player_id", playerIds);

  if (responsesError) {
    return err({ code: "internal", message: "Erro ao carregar respostas de fadiga" });
  }

  const answeredMap = new Map<string, { pre: boolean; post: boolean }>();
  for (const r of responses ?? []) {
    const entry = answeredMap.get(r.player_id) ?? { pre: false, post: false };
    if (r.phase === "pre") entry.pre = true;
    if (r.phase === "post") entry.post = true;
    answeredMap.set(r.player_id, entry);
  }

  const entries: QuestionnaireListEntry[] = (players ?? [])
    .map((p) => ({
      playerId: p.id as string,
      fullName: p.full_name as string,
      jerseyNum: (p.jersey_num as number | null) ?? null,
      answeredPre: answeredMap.get(p.id as string)?.pre ?? false,
      answeredPost: answeredMap.get(p.id as string)?.post ?? false,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-PT"));

  return ok({ requiresQuestionnaire: true, entries });
}

export interface StaffQuestionnairePlayer {
  id: string;
  fullName: string;
  ageGroup: string | null;
}

/**
 * assertPlayerAccessible — Verifica archived_at IS NULL e processing_restricted=false
 * para um jogador já confirmado no âmbito do staff. Chamada independentemente por
 * CADA leitura de dados de bem-estar/presença (não só pela que resolve o jogador) —
 * loopback #2/#3: nunca confiar apenas na ordem de chamadas do caller.
 */
async function assertPlayerAccessible(
  serviceRole: ReturnType<typeof getServiceRoleClient>,
  playerId: string,
  clubId: string
): Promise<AppError | null> {
  const { data: player, error } = await serviceRole
    .from("players")
    .select("archived_at, processing_restricted")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) {
    return { code: "internal", message: "Erro ao verificar jogador" };
  }
  if (!player || player.archived_at != null) {
    return { code: "not_found", message: "Recurso não encontrado" };
  }
  if (player.processing_restricted === true) {
    return {
      code: "processing_restricted",
      message:
        "O tratamento dos dados deste jogador está limitado. Não é possível apresentar ou registar respostas.",
    };
  }
  return null;
}

/**
 * getPlayerForStaffQuestionnaire — Resolve o jogador-alvo para a página host do
 * questionário staff-mediado, e é a PRIMEIRA leitura de dados a correr (antes de qualquer
 * dado de bem-estar): confirma âmbito de equipas, archived_at IS NULL, e devolve erro claro
 * de imediato se `processing_restricted` — a página nunca chega a pré-preencher/mostrar
 * dados de bem-estar de um jogador com tratamento limitado (loopback #2).
 */
export async function getPlayerForStaffQuestionnaire(
  playerId: string
): Promise<Result<StaffQuestionnairePlayer, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId, teamIds } = authResult.data;

  const playerIds = await getPlayerIdsForTeams(teamIds);
  if (!playerIds.includes(playerId)) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const serviceRole = getServiceRoleClient();

  const accessError = await assertPlayerAccessible(serviceRole, playerId, clubId);
  if (accessError) return err(accessError);

  const { data: player, error } = await serviceRole
    .from("players")
    .select("id, full_name, age_group")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) {
    return err({ code: "internal", message: "Erro ao carregar jogador" });
  }

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  return ok({
    id: player.id as string,
    fullName: player.full_name as string,
    ageGroup: (player.age_group as string | null) ?? null,
  });
}

/**
 * getPlayerAttendanceStatusForStaff — Estado de presença do jogador-alvo numa sessão,
 * para a guarda de ausência na fase 'post' da página host staff-mediada (equivalente
 * staff de getPlayerAttendanceForSession, que é self-scoped via auth.uid()).
 */
export async function getPlayerAttendanceStatusForStaff(
  playerId: string,
  sessionId: string
): Promise<Result<string | null, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId, teamIds } = authResult.data;

  const playerIds = await getPlayerIdsForTeams(teamIds);
  if (!playerIds.includes(playerId)) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const serviceRole = getServiceRoleClient();

  const accessError = await assertPlayerAccessible(serviceRole, playerId, clubId);
  if (accessError) return err(accessError);

  const { data, error } = await serviceRole
    .from("attendances")
    .select("status")
    .eq("session_id", sessionId)
    .eq("player_id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) {
    return err({ code: "internal", message: "Erro ao carregar presença" });
  }

  return ok((data?.status as string | null) ?? null);
}

export interface StaffExistingFatigueResponse {
  dim_energy: number;
  dim_focus: number;
  dim_sleep: number;
  dim_soreness: number;
  dim_mood: number;
  srpe_value: number | null;
  muscle_pain_zones: MusclePainZone[] | null;
  has_exams_this_week: boolean | null;
}

/**
 * getExistingFatigueResponseForStaff — Resposta já existente (se houver) do jogador-alvo
 * para uma dada fase/sessão, usada pela página host para pré-preencher o formulário em
 * modo de edição. Filtrado por club_id (defesa em profundidade, mesmo padrão de
 * getExistingFatigueResponse/getPlayerFatigueData). SÓ deve ser chamada depois de
 * getPlayerForStaffQuestionnaire confirmar que o jogador não tem processing_restricted
 * (loopback #2 — nunca mostrar dados de bem-estar antes dessa verificação).
 *
 * Lê valores reais de dimensões — por isso passa por auditedRead() (FR50), tal como
 * getPlayerFatigueData.
 */
export async function getExistingFatigueResponseForStaff(
  playerId: string,
  sessionId: string,
  phase: "pre" | "post"
): Promise<Result<StaffExistingFatigueResponse | null, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId, teamIds } = authResult.data;

  const playerIds = await getPlayerIdsForTeams(teamIds);
  if (!playerIds.includes(playerId)) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const serviceRole = getServiceRoleClient();

  const accessError = await assertPlayerAccessible(serviceRole, playerId, clubId);
  if (accessError) return err(accessError);

  let data: StaffExistingFatigueResponse | null = null;
  try {
    data = await auditedRead<StaffExistingFatigueResponse | null>(
      {
        action: "fatigue.staff_prefill_read",
        targetKind: "fatigue_response",
        targetId: playerId,
        actorId: userId,
        clubId,
        payload: { session_id: sessionId, phase },
      },
      async () => {
        // eslint-disable-next-line custom/no-direct-health-data-read -- query is legitimately wrapped in auditedRead()
        const { data: row, error } = await serviceRole
          .from("fatigue_responses")
          .select(
            "dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood, srpe_value, muscle_pain_zones, has_exams_this_week"
          )
          .eq("player_id", playerId)
          .eq("session_id", sessionId)
          .eq("phase", phase)
          .eq("club_id", clubId)
          .maybeSingle();

        if (error) throw error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (row ?? null) as any as StaffExistingFatigueResponse | null;
      }
    );
  } catch {
    return err({ code: "internal", message: "Erro ao carregar resposta existente" });
  }

  return ok(data);
}
