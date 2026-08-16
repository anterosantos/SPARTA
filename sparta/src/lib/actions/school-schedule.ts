"use server";

/**
 * school-schedule.ts — Server Actions para o horário semanal de saída da escola do jogador.
 *
 * Spec: _bmad-output/implementation-artifacts/spec-horario-saida-risco-atraso.md
 *
 * Padrão espelhado de `sparta/src/lib/actions/fatigue.ts` (submitFatigueResponse):
 * - Autenticação via createServerClient() + auth.getUser()
 * - Resolução do jogador via profile_id = auth.uid() (nunca confiar num player_id vindo do cliente)
 * - Escrita via service role (getServiceRoleClient()), depois de verificar a posse do registo
 * - RLS (000397_player_school_schedule.sql) garante defesa em profundidade caso o service role
 *   não seja usado num caminho futuro
 *
 * Não é dado de saúde — nunca usar auditedRead() nem a regra no-direct-health-data-read.
 */

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { logger } from "@/lib/logger";
import {
  SaveSchoolScheduleInputSchema,
  type SaveSchoolScheduleInput,
  type WeeklySchedule,
  type SchoolTerm,
} from "@/lib/schemas/school-schedule";

export interface MySchoolSchedule {
  weekly: WeeklySchedule;
  terms: SchoolTerm[];
}

const EMPTY_WEEKLY: WeeklySchedule = {
  mon_time: null,
  tue_time: null,
  wed_time: null,
  thu_time: null,
  fri_time: null,
};

/**
 * getMySchoolSchedule — Devolve o horário semanal + intervalos letivos do jogador autenticado.
 * Sem registo ainda: devolve horário vazio (todos os dias null) e terms=[] (I/O Matrix — "Nunca preencheu").
 */
export async function getMySchoolSchedule(): Promise<
  Result<MySchoolSchedule, AppError>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err({ code: "unauthorized", message: "Não autenticado" });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (playerError) {
    logger.error("school_schedule.player_lookup_failed", {
      user_id: user.id,
      error: playerError.message,
    });
    return err({ code: "internal", message: "Erro ao procurar registo de jogador" });
  }

  if (!player) {
    return err({ code: "not_found", message: "Sem registo de jogador para este utilizador" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated database.types
  const { data: weeklyRow, error: weeklyError } = await (supabase.from as any)(
    "player_school_schedule"
  )
    .select("mon_time, tue_time, wed_time, thu_time, fri_time")
    .eq("player_id", player.id)
    .maybeSingle();

  if (weeklyError) {
    logger.error("school_schedule.weekly_fetch_failed", {
      player_id: player.id,
      error: weeklyError.message,
    });
    return err({ code: "internal", message: "Erro ao carregar horário" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated database.types
  const { data: termRows, error: termsError } = await (supabase.from as any)(
    "player_school_terms"
  )
    .select("start_date, end_date")
    .eq("player_id", player.id)
    .order("start_date", { ascending: true });

  if (termsError) {
    logger.error("school_schedule.terms_fetch_failed", {
      player_id: player.id,
      error: termsError.message,
    });
    return err({ code: "internal", message: "Erro ao carregar intervalos letivos" });
  }

  const weekly: WeeklySchedule = weeklyRow
    ? {
        mon_time: (weeklyRow.mon_time as string | null)?.slice(0, 5) ?? null,
        tue_time: (weeklyRow.tue_time as string | null)?.slice(0, 5) ?? null,
        wed_time: (weeklyRow.wed_time as string | null)?.slice(0, 5) ?? null,
        thu_time: (weeklyRow.thu_time as string | null)?.slice(0, 5) ?? null,
        fri_time: (weeklyRow.fri_time as string | null)?.slice(0, 5) ?? null,
      }
    : EMPTY_WEEKLY;

  const terms: SchoolTerm[] = ((termRows ?? []) as { start_date: string; end_date: string }[]).map(
    (t) => ({ startDate: t.start_date, endDate: t.end_date })
  );

  return ok({ weekly, terms });
}

/**
 * saveMySchoolSchedule — Valida e grava o horário semanal + intervalos letivos do jogador autenticado.
 *
 * - Upsert do horário semanal (ON CONFLICT (player_id) DO UPDATE)
 * - Substituição total dos intervalos letivos (delete + insert) — mais simples que diff, e o
 *   volume esperado (poucos intervalos por jogador) torna o custo irrelevante
 */
export async function saveMySchoolSchedule(
  payload: SaveSchoolScheduleInput
): Promise<Result<{ playerId: string }, AppError>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err({ code: "unauthorized", message: "Não autenticado" });
  }

  const validated = SaveSchoolScheduleInputSchema.safeParse(payload);
  if (!validated.success) {
    return err({
      code: "validation",
      message: validated.error.issues[0]?.message ?? "Dados de horário inválidos",
      details: { issues: validated.error.issues },
    });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (playerError) {
    logger.error("school_schedule.player_lookup_failed", {
      user_id: user.id,
      error: playerError.message,
    });
    return err({ code: "internal", message: "Erro ao procurar registo de jogador" });
  }

  if (!player) {
    return err({ code: "not_found", message: "Sem registo de jogador para este utilizador" });
  }

  const { weekly, terms } = validated.data;
  const serviceRole = getServiceRoleClient();

  // Re-verificar club_id imediatamente antes do upsert para mitigar race condition de transferência.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentPlayer, error: reCheckError } = await (supabase.from as any)("players")
    .select("club_id")
    .eq("id", player.id)
    .maybeSingle();

  if (reCheckError || !currentPlayer || currentPlayer.club_id !== player.club_id) {
    logger.warn("school_schedule.club_id_mismatch", {
      player_id: player.id,
      original_club_id: player.club_id,
      current_club_id: currentPlayer?.club_id,
    });
    return err({ code: "forbidden", message: "Não podes editar esta informação (transferência em progresso?)" });
  }

  // Upsert do horário semanal (idempotente por player_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated database.types
  const { error: weeklyError } = await (serviceRole.from as any)("player_school_schedule").upsert(
    {
      club_id: player.club_id,
      player_id: player.id,
      mon_time: weekly.mon_time,
      tue_time: weekly.tue_time,
      wed_time: weekly.wed_time,
      thu_time: weekly.thu_time,
      fri_time: weekly.fri_time,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id", ignoreDuplicates: false }
  );

  if (weeklyError) {
    logger.error("school_schedule.weekly_upsert_failed", {
      player_id: player.id,
      error: weeklyError.message,
    });
    return err({ code: "internal", message: weeklyError.message ?? "Erro ao guardar horário" });
  }

  // Substituição total dos intervalos letivos: delete + insert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated database.types
  const { error: deleteError } = await (serviceRole.from as any)("player_school_terms")
    .delete()
    .eq("player_id", player.id);

  if (deleteError) {
    logger.error("school_schedule.terms_delete_failed", {
      player_id: player.id,
      error: deleteError.message,
    });
    return err({ code: "internal", message: "Erro ao substituir intervalos letivos" });
  }

  const termRows = terms.map((t) => ({
    club_id: player.club_id,
    player_id: player.id,
    start_date: t.startDate,
    end_date: t.endDate,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated database.types
  const { error: insertError } = await (serviceRole.from as any)("player_school_terms").insert(
    termRows
  );

  if (insertError) {
    logger.error("school_schedule.terms_insert_failed", {
      player_id: player.id,
      error: insertError.message,
    });
    return err({ code: "internal", message: "Erro ao guardar intervalos letivos" });
  }

  logger.info("school_schedule.saved", {
    player_id: player.id,
    terms_count: terms.length,
  });

  return ok({ playerId: player.id });
}
