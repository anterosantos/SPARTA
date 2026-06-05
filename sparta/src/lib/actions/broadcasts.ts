"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { Result, AppError } from "@/lib/types";
import { ok, err } from "@/lib/types";

export interface BroadcastItem {
  id: string;
  message: string;
  createdAt: string;
  coachId: string;
}

const SendBroadcastSchema = z.object({
  message: z
    .string()
    .min(1, "Mensagem não pode estar vazia")
    .max(500, "Máximo 500 caracteres"),
});

export async function sendBroadcast(
  input: unknown
): Promise<Result<void, AppError>> {
  const validated = SendBroadcastSchema.safeParse(input);
  if (!validated.success) {
    const message = validated.error.issues[0]?.message ?? "Dados inválidos";
    return err({ code: "validation", message });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });
  if (profile.role !== "coach")
    return err({ code: "forbidden", message: "Apenas treinadores podem enviar mensagens" });

  const serviceRole = getServiceRoleClient();

  // 1. Inserir o broadcast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: broadcast, error: broadcastError } = await (serviceRole as any)
    .from("broadcasts")
    .insert({
      club_id: profile.club_id,
      coach_id: user.id,
      message: validated.data.message.trim(),
    })
    .select("id")
    .single();

  if (broadcastError) return err({ code: "unknown", message: broadcastError.message });

  // 2. Criar notification_log para todos os jogadores activos do clube
  // send-push (cron de 5 min) irá processar e enviar o push.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: players } = await (serviceRole as any)
    .from("players")
    .select("profile_id")
    .eq("club_id", profile.club_id)
    .eq("is_archived", false)
    .eq("is_active", true)
    .eq("processing_restricted", false)
    .not("profile_id", "is", null);

  const eligibleProfileIds: string[] = ((players ?? []) as Array<{ profile_id: string }>)
    .map((p) => p.profile_id)
    .filter(Boolean);

  if (eligibleProfileIds.length > 0) {
    const now = new Date().toISOString();
    const notifRows = eligibleProfileIds.map((profileId) => ({
      club_id: profile.club_id,
      profile_id: profileId,
      session_id: null,
      broadcast_id: (broadcast as { id: string }).id,
      kind: "broadcast",
      scheduled_for: now,
      status: "scheduled",
    }));

    // notification_log requer service role — RLS só tem SELECT para authenticated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceRole as any).from("notification_log").upsert(notifRows, {
      onConflict: "profile_id,broadcast_id",
      ignoreDuplicates: true,
    });
  }

  revalidatePath("/mensagens");
  return ok(undefined);
}

export async function getBroadcastsForClub(): Promise<
  Result<BroadcastItem[], AppError>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });
  if (!["coach", "analyst"].includes(profile.role ?? ""))
    return err({ code: "forbidden", message: "Acesso negado" });

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("broadcasts")
    .select("id, message, created_at, coach_id")
    .eq("club_id", profile.club_id)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return err({ code: "unknown", message: error.message });

  const items: BroadcastItem[] = ((data as Array<Record<string, unknown>>) ?? []).map(
    (row) => ({
      id: row["id"] as string,
      message: row["message"] as string,
      createdAt: row["created_at"] as string,
      coachId: row["coach_id"] as string,
    })
  );

  return ok(items);
}
