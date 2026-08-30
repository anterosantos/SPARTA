import { z } from "zod";

export const MATCH_ACTIONS = [
  "ball_loss",
  "ball_recovery",
  "shot_total",
  "shot_on_target",
  "pass_completed",
  "def_pressure",
  "def_action_success",
  "off_action_success",
  // Sprint 1.5 — novos tipos (FR27a, FR27b, FR27c, FR27d, FR31a)
  "goal",
  "card",
  "corner",
  "entry_opp_area",
  "entry_own_area",
  "match_time_record",
  // Marcador de intervalo — fim da 1ª parte / início da 2ª parte
  "half_time",
] as const;

/**
 * Etiqueta (PT) e polaridade (positivo=verde/negativo=vermelho) de cada tipo de
 * evento — fonte única partilhada entre o botão de captura (ActionButton, ícone à
 * parte) e o resumo do jogo (agregado da equipa), para nunca divergirem.
 */
export const MATCH_ACTION_INFO: Record<
  (typeof MATCH_ACTIONS)[number],
  { label: string; positive: boolean }
> = {
  ball_loss: { label: "Perda de bola", positive: false },
  ball_recovery: { label: "Recuperação", positive: true },
  shot_total: { label: "Remate desenquadrado", positive: false },
  shot_on_target: { label: "Remate enquadrado", positive: true },
  pass_completed: { label: "Passe completado", positive: true },
  def_pressure: { label: "Pressão defensiva", positive: false },
  def_action_success: { label: "Ação def. com sucesso", positive: true },
  off_action_success: { label: "Ação of. com sucesso", positive: true },
  goal: { label: "Golo", positive: true },
  card: { label: "Cartão", positive: false },
  corner: { label: "Canto", positive: false },
  entry_opp_area: { label: "Entrada área adversária", positive: true },
  entry_own_area: { label: "Entrada na nossa área", positive: false },
  match_time_record: { label: "Tempos de jogo", positive: true },
  half_time: { label: "Intervalo", positive: true },
};

// Ações que requerem 4.º ecrã de contexto
export const CONTEXT_ACTIONS = ["goal", "card"] as const;
export type ContextAction = (typeof CONTEXT_ACTIONS)[number];

export function requiresContext(action: string): action is ContextAction {
  return (CONTEXT_ACTIONS as readonly string[]).includes(action);
}

export const MATCH_ZONES = [
  "def_left",
  "def_center",
  "def_right",
  "mid_def_left",
  "mid_def_center",
  "mid_def_right",
  "mid_att_left",
  "mid_att_center",
  "mid_att_right",
  "att_left",
  "att_center",
  "att_right",
] as const;

// Contexto para golos (FR27a)
export const GoalContextSchema = z.object({
  play_type: z.enum(["corner", "open_play", "free_kick", "other"]),
  period: z.number().int().min(1).max(2),
  minute: z.number().int().min(0).max(120).nullable().optional(),
  team: z.enum(["own", "opponent"]).default("own"),
});

// Contexto para cartões (FR27b)
export const CardContextSchema = z.object({
  card_type: z.enum(["yellow", "red"]),
  infraction_type: z.enum(["verbal", "foul"]),
  period: z.number().int().min(1).max(2),
});

// Contexto para registo de tempos de jogo (FR27d, T1.5.11)
export const MatchTimeContextSchema = z.object({
  total_minutes: z.number().int().min(0).max(200),
  useful_minutes: z.number().int().min(0).max(200),
});

export const MatchEventContextSchema = z.union([
  GoalContextSchema,
  CardContextSchema,
  MatchTimeContextSchema,
]).nullable().optional();

export type GoalContext = z.infer<typeof GoalContextSchema>;
export type CardContext = z.infer<typeof CardContextSchema>;
export type MatchTimeContext = z.infer<typeof MatchTimeContextSchema>;

export const MatchEventInputSchema = z.object({
  id: z.string().uuid("ID deve ser UUID válido"),
  action: z.enum(MATCH_ACTIONS),
  zone: z.enum(MATCH_ZONES),
  // null = evento sem jogador associado (ex: acção do adversário, marcador de intervalo)
  player_id: z.string().uuid("ID do jogador inválido").nullable(),
  session_id: z.string().uuid("ID da sessão inválido"),
  occurred_at: z.string().datetime("Horário inválido"),
  captured_via: z.enum(["online", "offline-drain"]).default("online"),
  // Sprint 1.5 — contexto condicional (T1.5.10)
  context: MatchEventContextSchema,
});

export type MatchEventInput = z.infer<typeof MatchEventInputSchema>;

export const MatchEventUpdateSchema = z
  .object({
    action: z.enum(MATCH_ACTIONS).optional(),
    zone: z.enum(MATCH_ZONES).optional(),
    context: MatchEventContextSchema,
  })
  .refine((d) => d.action !== undefined || d.zone !== undefined, {
    message: "Pelo menos um campo (action ou zone) deve ser alterado",
  });

export type MatchEventUpdate = z.infer<typeof MatchEventUpdateSchema>;

export interface SessionEventEntry {
  id: string;
  action: (typeof MATCH_ACTIONS)[number];
  zone: (typeof MATCH_ZONES)[number];
  player_id: string | null;
  player_name: string | null;
  jersey_number: number | null;
  occurred_at: string;
  captured_via: "online" | "offline-drain";
  context?: Record<string, unknown> | null;
}
