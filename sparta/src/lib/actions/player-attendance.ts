"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { newId } from "@/lib/uuid";
import { z } from "zod";
import type { AttendanceStatus } from "@/lib/schemas/attendances";

const DeclareAbsenceSchema = z.object({
  session_id: z.string().uuid(),
  note: z.string().max(500).optional(),
});

/**
 * declarePlayerAbsence — Jogador declara que não vai estar presente numa sessão.
 *
 * O jogador pode declarar ausência com uma nota de justificação opcional.
 * O estado fica 'absent'. Só o próprio jogador pode alterar a sua presença.
 * Staff pode sempre sobrepor via o painel de presenças.
 */
export async function declarePlayerAbsence(
  input: unknown
): Promise<Result<{ status: AttendanceStatus }, AppError>> {
  const validated = DeclareAbsenceSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: validated.error.issues[0]?.message ?? "Dados inválidos" });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!player) return err({ code: "not_found", message: "Registo de jogador não encontrado" });

  const serviceRole = getServiceRoleClient();

  // Verify the session belongs to the player's club
  const { data: session } = await serviceRole
    .from("sessions")
    .select("id")
    .eq("id", validated.data.session_id)
    .eq("club_id", player.club_id)
    .maybeSingle();

  if (!session) return err({ code: "not_found", message: "Sessão não encontrada" });

  const { error: upsertError } = await serviceRole
    .from("attendances")
    .upsert(
      {
        id: newId(),
        club_id: player.club_id,
        session_id: validated.data.session_id,
        player_id: player.id,
        status: "absent",
        note: validated.data.note ?? null,
        recorded_by: user.id,
      },
      { onConflict: "session_id,player_id" }
    );

  if (upsertError) return err({ code: "unknown", message: upsertError.message });

  return ok({ status: "absent" as AttendanceStatus });
}

/**
 * cancelPlayerAbsence — Jogador cancela a declaração de ausência.
 *
 * O estado de retorno depende de se o jogador já preencheu o questionário pré:
 * - Questionário pré preenchido → 'present'
 * - Questionário pré ainda não preenchido → 'sem_questionario'
 */
export async function cancelPlayerAbsence(
  input: unknown
): Promise<Result<{ status: AttendanceStatus }, AppError>> {
  const validated = z.object({ session_id: z.string().uuid() }).safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: "session_id inválido" });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!player) return err({ code: "not_found", message: "Registo de jogador não encontrado" });

  const serviceRole = getServiceRoleClient();

  // Verificar se o questionário pré já foi submetido para esta sessão
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, custom/no-direct-health-data-read -- service role, player-scoped query (own data only)
  const { data: preResponse } = await (serviceRole as any)
    .from("fatigue_responses")
    .select("id")
    .eq("session_id", validated.data.session_id)
    .eq("player_id", player.id)
    .eq("club_id", player.club_id)
    .eq("phase", "pre")
    .maybeSingle();

  const newStatus: AttendanceStatus = preResponse ? "present" : "sem_questionario";

  const { error } = await serviceRole
    .from("attendances")
    .update({ status: newStatus, note: null })
    .eq("session_id", validated.data.session_id)
    .eq("player_id", player.id)
    .eq("club_id", player.club_id)
    .eq("status", "absent");

  if (error) return err({ code: "unknown", message: error.message });

  return ok({ status: newStatus });
}

/**
 * getPlayerAttendanceForSession — Lê o registo de presença do jogador numa sessão.
 */
export async function getPlayerAttendanceForSession(
  sessionId: string
): Promise<Result<{ status: AttendanceStatus; note: string | null } | null, AppError>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!player) return err({ code: "not_found", message: "Registo de jogador não encontrado" });

  const serviceRole = getServiceRoleClient();
  const { data, error } = await serviceRole
    .from("attendances")
    .select("status, note")
    .eq("session_id", sessionId)
    .eq("player_id", player.id)
    .eq("club_id", player.club_id)
    .maybeSingle();

  if (error) return err({ code: "unknown", message: error.message });
  if (!data) return ok(null);

  return ok({ status: data.status as AttendanceStatus, note: data.note as string | null });
}
