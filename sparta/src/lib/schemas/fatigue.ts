import { z } from "zod";

const DimensionScore = z.number().int().min(1).max(5);

// Zonas de dor muscular válidas (FR21b, T1.5.6)
export const MUSCLE_PAIN_ZONES = [
  "head",
  "neck",
  "shoulder_l", "shoulder_r",
  "elbow_l", "elbow_r",
  "wrist_l", "wrist_r",
  "hand_l", "hand_r",
  "chest", "abdomen",
  "back_upper_l", "back_upper_r",
  "back_lower_l", "back_lower_r",
  "hip_l", "hip_r",
  "thigh_l", "thigh_r",
  "knee_l", "knee_r",
  "shin_l", "shin_r",
  "calf_l", "calf_r",
  "ankle_l", "ankle_r",
  "achilles_l", "achilles_r",
  "foot_l", "foot_r",
] as const;

export type MusclePainZone = (typeof MUSCLE_PAIN_ZONES)[number];

/**
 * Base object schema — use this when you need .omit()/.pick()/.extend().
 * ZodEffects (schemas with .refine()) do not support those methods.
 */
export const FatigueResponseBaseSchema = z.object({
  id: z.string().uuid(), // client-generated UUIDv7 (NFR48, AR4)
  player_id: z.string().uuid(),
  session_id: z.string().uuid(),
  phase: z.enum(["pre", "post"]),
  dim_energy: DimensionScore,
  dim_focus: DimensionScore,
  dim_sleep: DimensionScore,
  dim_soreness: DimensionScore,
  dim_mood: DimensionScore,
  srpe_value: z.number().int().min(1).max(10).nullable().optional(),
  // Sprint 1.5 — novos campos de bem-estar (T1.5.1)
  muscle_pain_zones: z.array(z.enum(MUSCLE_PAIN_ZONES)).nullable().optional(),
  has_exams_this_week: z.boolean().nullable().optional(),
  submitted_via: z.enum(["online", "offline-drain"]).default("online"),
});

/**
 * Full validated schema — includes cross-field refinements.
 *
 * - PRE phase: srpe_value MUST be null; muscle_pain_zones MUST be null
 * - POST phase: srpe_value MUST be a number (1–10); has_exams_this_week MUST be null
 */
export const FatigueResponseSchema = FatigueResponseBaseSchema.refine(
  (d) => {
    if (d.phase === "pre") return d.srpe_value == null;
    if (d.phase === "post") return d.srpe_value != null;
    return true;
  },
  {
    message: "post phase requer srpe_value (1–10); pre phase não permite",
    path: ["srpe_value"],
  }
).refine(
  (d) => {
    if (d.phase === "pre") return d.muscle_pain_zones == null;
    return true;
  },
  {
    message: "muscle_pain_zones apenas permitido em fase post",
    path: ["muscle_pain_zones"],
  }
).refine(
  (d) => {
    if (d.phase === "post") return d.has_exams_this_week == null;
    return true;
  },
  {
    message: "has_exams_this_week apenas permitido em fase pre",
    path: ["has_exams_this_week"],
  }
);

export type FatigueResponseInput = z.infer<typeof FatigueResponseSchema>;
