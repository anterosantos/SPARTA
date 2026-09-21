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
  // Marcadores de fase do jogo — cronómetro em directo na captura de eventos
  "match_start",
  "half_time",
  "second_half_start",
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
  match_start: { label: "Início do jogo", positive: true },
  half_time: { label: "Fim da 1ª parte", positive: true },
  second_half_start: { label: "Início da 2ª parte", positive: true },
};

// Ações que requerem 4.º ecrã de contexto
export const CONTEXT_ACTIONS = ["goal", "card"] as const;
export type ContextAction = (typeof CONTEXT_ACTIONS)[number];

export function requiresContext(action: string): action is ContextAction {
  return (CONTEXT_ACTIONS as readonly string[]).includes(action);
}

// Zonas activas — 24 sectores (6 linhas × 4 colunas), do ataque para a defesa,
// esquerda→direita em cada linha. Substitui o esquema anterior de 12 sectores
// para eventos novos (ver LEGACY_MATCH_ZONES mais abaixo para jogos antigos).
export const MATCH_ZONES = [
  "att_end_left", "att_end_midleft", "att_end_midright", "att_end_right",
  "att_box_left", "att_box_midleft", "att_box_midright", "att_box_right",
  "mid_off_left", "mid_off_midleft", "mid_off_midright", "mid_off_right",
  "mid_back_left", "mid_back_midleft", "mid_back_midright", "mid_back_right",
  "def_box_left", "def_box_midleft", "def_box_midright", "def_box_right",
  "def_end_left", "def_end_midleft", "def_end_midright", "def_end_right",
] as const;

// Etiqueta (PT) de cada zona — fonte única partilhada entre o selector de
// zonas, o ring de eventos recentes, a lista de revisão e o resumo do jogo.
export const MATCH_ZONE_LABEL: Record<(typeof MATCH_ZONES)[number], string> = {
  att_end_left: "Ataque linha de fundo esquerda",
  att_end_midleft: "Ataque linha de fundo centro esquerda",
  att_end_midright: "Ataque linha de fundo centro direita",
  att_end_right: "Ataque linha de fundo direita",
  att_box_left: "Ataque entrada área esquerda",
  att_box_midleft: "Ataque entrada área centro esquerda",
  att_box_midright: "Ataque entrada área centro direita",
  att_box_right: "Ataque entrada área direita",
  mid_off_left: "Meio campo ofensivo esquerda",
  mid_off_midleft: "Meio campo ofensivo centro esquerda",
  mid_off_midright: "Meio campo ofensivo centro direita",
  mid_off_right: "Meio campo ofensivo direita",
  mid_back_left: "Meio campo defensivo esquerda",
  mid_back_midleft: "Meio campo defensivo centro esquerda",
  mid_back_midright: "Meio campo defensivo centro direita",
  mid_back_right: "Meio campo defensivo direita",
  def_box_left: "Defesa entrada área esquerda",
  def_box_midleft: "Defesa entrada área centro esquerda",
  def_box_midright: "Defesa entrada área centro direita",
  def_box_right: "Defesa entrada área direita",
  def_end_left: "Defesa linha de fundo esquerda",
  def_end_midleft: "Defesa linha de fundo centro esquerda",
  def_end_midright: "Defesa linha de fundo centro direita",
  def_end_right: "Defesa linha de fundo direita",
};

// Zonas legadas — esquema de 12 sectores (3 colunas × 4 linhas) usado antes
// desta migração. Não capturáveis por eventos novos (fora de MATCH_ZONES),
// mas continuam válidas na BD (match_events_zone_check) — jogos antigos têm
// de continuar a mostrar-se com este layout, nunca reinterpretados como se
// fossem as novas 24 zonas.
export const LEGACY_MATCH_ZONES = [
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

export const LEGACY_MATCH_ZONE_LABEL: Record<(typeof LEGACY_MATCH_ZONES)[number], string> = {
  def_left: "Defesa esquerda",
  def_center: "Defesa centro",
  def_right: "Defesa direita",
  mid_def_left: "MC defensivo esq.",
  mid_def_center: "MC defensivo centro",
  mid_def_right: "MC defensivo dir.",
  mid_att_left: "MC ofensivo esq.",
  mid_att_center: "MC ofensivo centro",
  mid_att_right: "MC ofensivo dir.",
  att_left: "Ataque esquerda",
  att_center: "Ataque centro",
  att_right: "Ataque direita",
};

const LEGACY_ZONE_SET: ReadonlySet<string> = new Set(LEGACY_MATCH_ZONES);

/** true se `zone` pertence ao esquema legado de 12 sectores (jogo antigo). */
export function isLegacyZone(zone: string): zone is (typeof LEGACY_MATCH_ZONES)[number] {
  return LEGACY_ZONE_SET.has(zone);
}

/**
 * Rótulo (PT) de uma zona, seja do esquema activo (24) ou legado (12) — usar
 * sempre que a zona de um evento possa vir de um jogo antigo (ex.: lista de
 * revisão de eventos). Cai para a própria string se, por algum motivo, não
 * houver nenhum mapeamento (nunca deve acontecer com dados válidos).
 */
export function resolveZoneLabel(zone: string): string {
  if (zone in MATCH_ZONE_LABEL) return MATCH_ZONE_LABEL[zone as (typeof MATCH_ZONES)[number]];
  if (zone in LEGACY_MATCH_ZONE_LABEL) return LEGACY_MATCH_ZONE_LABEL[zone as (typeof LEGACY_MATCH_ZONES)[number]];
  return zone;
}

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
