/**
 * Admin Schema Types (Story 8.1+)
 *
 * TypeScript interfaces for admin tables:
 * - rosters
 * - teams
 * - team_players
 * - team_coaches
 * - player_loans
 *
 * These types are used by Server Actions and database queries in Stories 8.2-8.8.
 */

export interface Roster {
  id: string;
  club_id: string;
  season_id: string;
  name: string;
  status: "active" | "archived";
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  roster_id: string;
  name: string;
  escalao?: string | null;
  level?: string | null;
  is_b_team: boolean;
  color_hex?: string | null;
  description?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamPlayer {
  id: string;
  team_id: string;
  player_id: string;
  status: "active" | "loaned" | "reserve";
  position?: string | null;
  joined_at: string;
  left_at?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamCoach {
  id: string;
  team_id: string;
  profile_id: string;
  role: "principal" | "assistant" | "analyst";
  joined_at: string;
  left_at?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlayerLoan {
  id: string;
  player_id: string;
  from_team_id: string;
  to_team_id: string;
  requested_by?: string | null;
  approved_by?: string | null;
  status: "pending" | "approved" | "rejected" | "returned";
  requested_at: string;
  approved_at?: string | null;
  returned_at?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

// Zod schemas (for use in Server Actions, Story 8.3+)
import { z } from "zod";

export const RosterCreateSchema = z.object({
  club_id: z.string().uuid(),
  season_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  status: z.enum(["active", "archived"]).default("active"),
});

export const RosterUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(["active", "archived"]).optional(),
  is_archived: z.boolean().optional(),
});

export const TeamCreateSchema = z.object({
  roster_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  escalao: z.string().max(50).nullable().optional(),
  level: z.string().max(50).nullable().optional(),
  is_b_team: z.boolean().default(false),
  color_hex: z.string().regex(/^#([0-9A-F]{6}|[0-9A-F]{3})$/i).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export const TeamUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  escalao: z.string().max(50).nullable().optional(),
  level: z.string().max(50).nullable().optional(),
  is_b_team: z.boolean().optional(),
  color_hex: z.string().regex(/^#([0-9A-F]{6}|[0-9A-F]{3})$/i).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  is_archived: z.boolean().optional(),
});

export const TeamPlayerCreateSchema = z.object({
  team_id: z.string().uuid(),
  player_id: z.string().uuid(),
  status: z.enum(["active", "loaned", "reserve"]).default("active"),
  position: z.string().max(50).nullable().optional(),
});

export const TeamPlayerUpdateSchema = z.object({
  status: z.enum(["active", "loaned", "reserve"]).optional(),
  position: z.string().max(50).nullable().optional(),
  left_at: z.string().datetime().nullable().optional(),
  is_archived: z.boolean().optional(),
});

export const TeamCoachCreateSchema = z.object({
  team_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role: z.enum(["principal", "assistant", "analyst"]).default("assistant"),
});

export const TeamCoachUpdateSchema = z.object({
  role: z.enum(["principal", "assistant", "analyst"]).optional(),
  left_at: z.string().datetime().nullable().optional(),
  is_archived: z.boolean().optional(),
});

export const PlayerLoanCreateSchema = z.object({
  player_id: z.string().uuid(),
  from_team_id: z.string().uuid(),
  to_team_id: z.string().uuid(),
  requested_by: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "approved", "rejected", "returned"]).default("pending"),
  note: z.string().max(1000).nullable().optional(),
});

export const PlayerLoanUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "returned"]).optional(),
  approved_by: z.string().uuid().nullable().optional(),
  approved_at: z.string().datetime().nullable().optional(),
  returned_at: z.string().datetime().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export type RosterCreateInput = z.infer<typeof RosterCreateSchema>;
export type RosterUpdateInput = z.infer<typeof RosterUpdateSchema>;
export type TeamCreateInput = z.infer<typeof TeamCreateSchema>;
export type TeamUpdateInput = z.infer<typeof TeamUpdateSchema>;
export type TeamPlayerCreateInput = z.infer<typeof TeamPlayerCreateSchema>;
export type TeamPlayerUpdateInput = z.infer<typeof TeamPlayerUpdateSchema>;
export type TeamCoachCreateInput = z.infer<typeof TeamCoachCreateSchema>;
export type TeamCoachUpdateInput = z.infer<typeof TeamCoachUpdateSchema>;
export type PlayerLoanCreateInput = z.infer<typeof PlayerLoanCreateSchema>;
export type PlayerLoanUpdateInput = z.infer<typeof PlayerLoanUpdateSchema>;
