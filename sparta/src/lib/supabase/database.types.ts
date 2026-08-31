export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _schema_migrations: {
        Row: {
          executed_at: string | null
          name: string
          version: number
        }
        Insert: {
          executed_at?: string | null
          name: string
          version: number
        }
        Update: {
          executed_at?: string | null
          name?: string
          version?: number
        }
        Relationships: []
      }
      attendances: {
        Row: {
          club_id: string
          id: string
          note: string | null
          player_id: string
          recorded_at: string
          recorded_by: string
          session_id: string
          status: string
        }
        Insert: {
          club_id: string
          id?: string
          note?: string | null
          player_id: string
          recorded_at?: string
          recorded_by: string
          session_id: string
          status: string
        }
        Update: {
          club_id?: string
          id?: string
          note?: string | null
          player_id?: string
          recorded_at?: string
          recorded_by?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "attendances_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          club_id: string
          id: string
          occurred_at: string
          payload: Json | null
          target_id: string | null
          target_kind: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          club_id: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          target_id?: string | null
          target_kind: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          club_id?: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          target_id?: string | null
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_dismissals: {
        Row: {
          broadcast_id: string
          dismissed_at: string
          profile_id: string
        }
        Insert: {
          broadcast_id: string
          dismissed_at?: string
          profile_id: string
        }
        Update: {
          broadcast_id?: string
          dismissed_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_dismissals_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_dismissals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          club_id: string
          coach_id: string
          created_at: string
          id: string
          message: string
        }
        Insert: {
          club_id: string
          coach_id: string
          created_at?: string
          id?: string
          message: string
        }
        Update: {
          club_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          country: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      consent_reconfirmations: {
        Row: {
          anonymized_at: string | null
          club_id: string
          confirmed_at: string | null
          created_at: string
          id: string
          player_id: string
          profile_id: string
          status: string
          token: string
        }
        Insert: {
          anonymized_at?: string | null
          club_id: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          player_id: string
          profile_id: string
          status: string
          token: string
        }
        Update: {
          anonymized_at?: string | null
          club_id?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          player_id?: string
          profile_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_reconfirmations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_reconfirmations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_reconfirmations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "consent_reconfirmations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_decisions: {
        Row: {
          actor_id: string | null
          club_id: string
          created_at: string
          decision_kind: string
          id: string
          note: string | null
          player_id: string | null
          session_id: string | null
          was_data_driven: boolean
        }
        Insert: {
          actor_id?: string | null
          club_id: string
          created_at?: string
          decision_kind: string
          id?: string
          note?: string | null
          player_id?: string | null
          session_id?: string | null
          was_data_driven?: boolean
        }
        Update: {
          actor_id?: string | null
          club_id?: string
          created_at?: string
          decision_kind?: string
          id?: string
          note?: string | null
          player_id?: string | null
          session_id?: string | null
          was_data_driven?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "data_decisions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_decisions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_decisions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_decisions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "data_decisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_decisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      fatigue_responses: {
        Row: {
          club_id: string
          dim_energy: number
          dim_focus: number
          dim_mood: number
          dim_sleep: number
          dim_soreness: number
          has_exams_this_week: boolean | null
          id: string
          muscle_pain_zones: string[] | null
          phase: string
          player_id: string
          session_id: string
          srpe_value: number | null
          submitted_at: string
          submitted_via: string
        }
        Insert: {
          club_id: string
          dim_energy: number
          dim_focus: number
          dim_mood: number
          dim_sleep: number
          dim_soreness: number
          has_exams_this_week?: boolean | null
          id?: string
          muscle_pain_zones?: string[] | null
          phase: string
          player_id: string
          session_id: string
          srpe_value?: number | null
          submitted_at?: string
          submitted_via?: string
        }
        Update: {
          club_id?: string
          dim_energy?: number
          dim_focus?: number
          dim_mood?: number
          dim_sleep?: number
          dim_soreness?: number
          has_exams_this_week?: boolean | null
          id?: string
          muscle_pain_zones?: string[] | null
          phase?: string
          player_id?: string
          session_id?: string
          srpe_value?: number | null
          submitted_at?: string
          submitted_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatigue_responses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fatigue_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      match_events: {
        Row: {
          action: string
          captured_at: string
          captured_by: string | null
          captured_via: string
          club_id: string
          context: Json | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          occurred_at: string
          player_id: string | null
          session_id: string
          zone: string
        }
        Insert: {
          action: string
          captured_at?: string
          captured_by?: string | null
          captured_via: string
          club_id: string
          context?: Json | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          occurred_at: string
          player_id?: string | null
          session_id: string
          zone: string
        }
        Update: {
          action?: string
          captured_at?: string
          captured_by?: string | null
          captured_via?: string
          club_id?: string
          context?: Json | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          occurred_at?: string
          player_id?: string | null
          session_id?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      match_lineup_stints: {
        Row: {
          id: string
          session_id: string
          player_id: string
          started_minute: number
          ended_minute: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          player_id: string
          started_minute?: number
          ended_minute?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          player_id?: string
          started_minute?: number
          ended_minute?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineup_stints_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_stints_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          created_at: string
          ended_minute: number | null
          id: string
          player_id: string
          role: string
          session_id: string
          shirt_num: number | null
          started_minute: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_minute?: number | null
          id?: string
          player_id: string
          role: string
          session_id: string
          shirt_num?: number | null
          started_minute?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_minute?: number | null
          id?: string
          player_id?: string
          role?: string
          session_id?: string
          shirt_num?: number | null
          started_minute?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_lineups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      notification_log: {
        Row: {
          broadcast_id: string | null
          club_id: string
          context_player_id: string | null
          created_at: string
          error_message: string | null
          id: string
          kind: string
          profile_id: string
          scheduled_for: string
          sent_at: string | null
          session_id: string | null
          status: string
        }
        Insert: {
          broadcast_id?: string | null
          club_id: string
          context_player_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind: string
          profile_id: string
          scheduled_for: string
          sent_at?: string | null
          session_id?: string | null
          status?: string
        }
        Update: {
          broadcast_id?: string | null
          club_id?: string
          context_player_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          profile_id?: string
          scheduled_for?: string
          sent_at?: string | null
          session_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_context_player_id_fkey"
            columns: ["context_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_context_player_id_fkey"
            columns: ["context_player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "notification_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          club_id: string
          event_edit_window_hours: number
          id: string
          is_enabled: boolean
          post_minutes: number
          pre_minutes: number
          updated_at: string
        }
        Insert: {
          club_id: string
          event_edit_window_hours?: number
          id?: string
          is_enabled?: boolean
          post_minutes?: number
          pre_minutes?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          event_edit_window_hours?: number
          id?: string
          is_enabled?: boolean
          post_minutes?: number
          pre_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_consent_reminders_log: {
        Row: {
          consent_id: string
          id: string
          kind: string
          sent_at: string
          status: string
        }
        Insert: {
          consent_id: string
          id?: string
          kind: string
          sent_at?: string
          status?: string
        }
        Update: {
          consent_id?: string
          id?: string
          kind?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "parental_consent_reminders_log_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "parental_consents"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_consents: {
        Row: {
          club_id: string
          confirmed_at: string | null
          confirmed_ip: unknown
          created_at: string
          id: string
          last_manual_resend_at: string | null
          parent_email: string | null
          parent_name: string | null
          player_id: string
          policy_version_id: string
          status: string
          token: string
          token_expires_at: string
        }
        Insert: {
          club_id: string
          confirmed_at?: string | null
          confirmed_ip?: unknown
          created_at?: string
          id?: string
          last_manual_resend_at?: string | null
          parent_email?: string | null
          parent_name?: string | null
          player_id: string
          policy_version_id: string
          status: string
          token: string
          token_expires_at: string
        }
        Update: {
          club_id?: string
          confirmed_at?: string | null
          confirmed_ip?: unknown
          created_at?: string
          id?: string
          last_manual_resend_at?: string | null
          parent_email?: string | null
          parent_name?: string | null
          player_id?: string
          policy_version_id?: string
          status?: string
          token?: string
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parental_consents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "parental_consents_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "privacy_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_reports: {
        Row: {
          club_id: string
          expires_at: string
          file_path: string
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          player_id: string
          scope: string
          shared_at: string | null
          shared_with_email: string | null
        }
        Insert: {
          club_id: string
          expires_at: string
          file_path: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          player_id: string
          scope: string
          shared_at?: string | null
          shared_with_email?: string | null
        }
        Update: {
          club_id?: string
          expires_at?: string
          file_path?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          player_id?: string
          scope?: string
          shared_at?: string | null
          shared_with_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_reports_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
        ]
      }
      player_inbox_dismissals: {
        Row: {
          dismissed_at: string
          kind: string
          profile_id: string
          session_id: string
        }
        Insert: {
          dismissed_at?: string
          kind: string
          profile_id: string
          session_id: string
        }
        Update: {
          dismissed_at?: string
          kind?: string
          profile_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_inbox_dismissals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_inbox_dismissals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_inbox_dismissals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      player_loans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          from_team_id: string
          id: string
          note: string | null
          player_id: string
          requested_at: string
          requested_by: string | null
          returned_at: string | null
          status: string
          to_team_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          from_team_id: string
          id?: string
          note?: string | null
          player_id: string
          requested_at?: string
          requested_by?: string | null
          returned_at?: string | null
          status?: string
          to_team_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          from_team_id?: string
          id?: string
          note?: string | null
          player_id?: string
          requested_at?: string
          requested_by?: string | null
          returned_at?: string | null
          status?: string
          to_team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_loans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_loans_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_loans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_loans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_loans_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_loans_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_metrics: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          height_cm: number | null
          id: string
          player_id: string
          recorded_at: string
          weight_kg: number | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          height_cm?: number | null
          id?: string
          player_id: string
          recorded_at?: string
          weight_kg?: number | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          height_cm?: number | null
          id?: string
          player_id?: string
          recorded_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_metrics_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_metrics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_metrics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_metrics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
        ]
      }
      players: {
        Row: {
          age_group: string
          archived_at: string | null
          birthdate: string
          club_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          inactive_reason: string | null
          invite_sent_at: string | null
          is_active: boolean
          is_archived: boolean
          jersey_num: number | null
          photo_path: string | null
          processing_restricted: boolean
          profile_id: string | null
          restricted_at: string | null
          updated_at: string
        }
        Insert: {
          age_group: string
          archived_at?: string | null
          birthdate: string
          club_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          inactive_reason?: string | null
          invite_sent_at?: string | null
          is_active?: boolean
          is_archived?: boolean
          jersey_num?: number | null
          photo_path?: string | null
          processing_restricted?: boolean
          profile_id?: string | null
          restricted_at?: string | null
          updated_at?: string
        }
        Update: {
          age_group?: string
          archived_at?: string | null
          birthdate?: string
          club_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          inactive_reason?: string | null
          invite_sent_at?: string | null
          is_active?: boolean
          is_archived?: boolean
          jersey_num?: number | null
          photo_path?: string | null
          processing_restricted?: boolean
          profile_id?: string | null
          restricted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          id: string
          is_primary: boolean
          player_id: string
          position: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_primary?: boolean
          player_id: string
          position: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_primary?: boolean
          player_id?: string
          position?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
        ]
      }
      privacy_policies: {
        Row: {
          body_full_md: string
          body_u14_md: string
          created_at: string
          effective_from: string
          id: string
          is_current: boolean
          version: string
        }
        Insert: {
          body_full_md: string
          body_u14_md: string
          created_at?: string
          effective_from?: string
          id?: string
          is_current?: boolean
          version: string
        }
        Update: {
          body_full_md?: string
          body_u14_md?: string
          created_at?: string
          effective_from?: string
          id?: string
          is_current?: boolean
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          club_id: string
          consent_status: string
          created_at: string
          full_name: string | null
          id: string
          processing_restricted: boolean
          restricted_at: string | null
          role: string
          updated_at: string
        }
        Insert: {
          club_id: string
          consent_status?: string
          created_at?: string
          full_name?: string | null
          id: string
          processing_restricted?: boolean
          restricted_at?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          consent_status?: string
          created_at?: string
          full_name?: string | null
          id?: string
          processing_restricted?: boolean
          restricted_at?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          club_id: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          keys_json: Json
          last_used_at: string | null
          profile_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          keys_json: Json
          last_used_at?: string | null
          profile_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          keys_json?: Json
          last_used_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_snapshots: {
        Row: {
          acwr: number | null
          acwr_band_hi: number | null
          acwr_band_lo: number | null
          attendance_rate: number | null
          club_id: string
          computed_at: string
          data_sufficient: boolean
          derived_age_group: string | null
          player_id: string
          recent_fatigue_avg: number | null
          session_id: string
          state: string
          version: number
        }
        Insert: {
          acwr?: number | null
          acwr_band_hi?: number | null
          acwr_band_lo?: number | null
          attendance_rate?: number | null
          club_id: string
          computed_at?: string
          data_sufficient?: boolean
          derived_age_group?: string | null
          player_id: string
          recent_fatigue_avg?: number | null
          session_id: string
          state?: string
          version?: number
        }
        Update: {
          acwr?: number | null
          acwr_band_hi?: number | null
          acwr_band_lo?: number | null
          attendance_rate?: number | null
          club_id?: string
          computed_at?: string
          data_sufficient?: boolean
          derived_age_group?: string | null
          player_id?: string
          recent_fatigue_avg?: number | null
          session_id?: string
          state?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "readiness_snapshots_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "readiness_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      rectification_requests: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          club_id: string
          created_at: string
          current_value: string | null
          field_name: string
          id: string
          notified_at: string | null
          player_id: string
          reason: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          requested_value: string
          status: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          club_id: string
          created_at?: string
          current_value?: string | null
          field_name: string
          id?: string
          notified_at?: string | null
          player_id: string
          reason?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          requested_value: string
          status?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          club_id?: string
          created_at?: string
          current_value?: string | null
          field_name?: string
          id?: string
          notified_at?: string | null
          player_id?: string
          reason?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          requested_value?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rectification_requests_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rectification_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rectification_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rectification_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "rectification_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rosters: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
          season_id: string
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          season_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          season_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rosters_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["season_id"]
          },
        ]
      }
      seasons: {
        Row: {
          club_id: string
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          start_date: string
        }
        Insert: {
          club_id: string
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          start_date: string
        }
        Update: {
          club_id?: string
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      session_metrics: {
        Row: {
          club_id: string
          computed_at: string
          duration_min: number
          id: string
          player_id: string
          session_id: string
          srpe_load: number | null
          srpe_value: number
        }
        Insert: {
          club_id: string
          computed_at?: string
          duration_min: number
          id?: string
          player_id: string
          session_id: string
          srpe_load?: number | null
          srpe_value: number
        }
        Update: {
          club_id?: string
          computed_at?: string
          duration_min?: number
          id?: string
          player_id?: string
          session_id?: string
          srpe_load?: number | null
          srpe_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_metrics_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_metrics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_metrics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "session_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      sessions: {
        Row: {
          club_id: string
          concentration_time: string | null
          convocatoria_sent_at: string | null
          created_at: string
          created_by: string
          duration_min: number
          id: string
          location: string | null
          notes: string | null
          opponent_name: string | null
          scheduled_at: string
          season_id: string
          status: string
          type: string
        }
        Insert: {
          club_id: string
          concentration_time?: string | null
          convocatoria_sent_at?: string | null
          created_at?: string
          created_by: string
          duration_min?: number
          id?: string
          location?: string | null
          notes?: string | null
          opponent_name?: string | null
          scheduled_at: string
          season_id: string
          status?: string
          type: string
        }
        Update: {
          club_id?: string
          concentration_time?: string | null
          convocatoria_sent_at?: string | null
          created_at?: string
          created_by?: string
          duration_min?: number
          id?: string
          location?: string | null
          notes?: string | null
          opponent_name?: string | null
          scheduled_at?: string
          season_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["season_id"]
          },
        ]
      }
      team_coaches: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          joined_at: string
          left_at: string | null
          profile_id: string
          role: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          joined_at?: string
          left_at?: string | null
          profile_id: string
          role?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          joined_at?: string
          left_at?: string | null
          profile_id?: string
          role?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_coaches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_players: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          joined_at: string
          left_at: string | null
          player_id: string
          position: string | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          joined_at?: string
          left_at?: string | null
          player_id: string
          position?: string | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          joined_at?: string
          left_at?: string | null
          player_id?: string
          position?: string | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color_hex: string | null
          created_at: string
          description: string | null
          escalao: string | null
          id: string
          is_archived: boolean
          is_b_team: boolean
          level: string | null
          name: string
          roster_id: string
          updated_at: string
        }
        Insert: {
          color_hex?: string | null
          created_at?: string
          description?: string | null
          escalao?: string | null
          id?: string
          is_archived?: boolean
          is_b_team?: boolean
          level?: string | null
          name: string
          roster_id: string
          updated_at?: string
        }
        Update: {
          color_hex?: string | null
          created_at?: string
          description?: string | null
          escalao?: string | null
          id?: string
          is_archived?: boolean
          is_b_team?: boolean
          level?: string | null
          name?: string
          roster_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "rosters"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          club_id: string
          id: string
          kind: string
          occurred_at: string
          payload_json: Json
        }
        Insert: {
          club_id: string
          id?: string
          kind: string
          occurred_at?: string
          payload_json: Json
        }
        Update: {
          club_id?: string
          id?: string
          kind?: string
          occurred_at?: string
          payload_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      match_minutes_played: {
        Row: {
          duration_min: number | null
          ended_minute: number | null
          minutes_played: number | null
          player_id: string | null
          session_id: string | null
          started_minute: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_lineup_stints_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_lineups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_clean_sheets"
            referencedColumns: ["session_id"]
          },
        ]
      }
      v_athlete_stats_per_season: {
        Row: {
          club_id: string | null
          convocacoes: number | null
          minutes_played: number | null
          pct_convocacoes: number | null
          pct_minutes: number | null
          player_id: string | null
          season_id: string | null
          season_name: string | null
          total_available_minutes: number | null
          total_match_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_clean_sheets: {
        Row: {
          clean_sheet_minutes: number | null
          club_id: string | null
          duration_min: number | null
          goals_conceded: number | null
          is_clean_sheet: boolean | null
          match_date: string | null
          season_id: string | null
          session_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_athlete_stats_per_season"
            referencedColumns: ["season_id"]
          },
        ]
      }
    }
    Functions: {
      anonymize_archived_player: {
        Args: { p_player_id: string }
        Returns: boolean
      }
      anonymize_player_pii: { Args: { p_player_id: string }; Returns: boolean }
      claim_push_notifications: {
        Args: { batch_size?: number }
        Returns: {
          broadcast_id: string | null
          club_id: string
          context_player_id: string | null
          created_at: string
          error_message: string | null
          id: string
          kind: string
          profile_id: string
          scheduled_for: string
          sent_at: string | null
          session_id: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      club_id: { Args: never; Returns: string }
      compute_acwr: {
        Args: { p_as_of: string; p_player_id: string }
        Returns: {
          acute: number
          age_group: string
          chronic: number
          data_sufficient: boolean
          ratio: number
          state: string
          threshold_hi: number
          threshold_lo: number
        }[]
      }
      detect_age_18_transitions: { Args: never; Returns: undefined }
      enforce_age_18_anonymization: { Args: never; Returns: undefined }
      fn_erase_subject_cascade: {
        Args: { p_actor_id: string; p_player_id: string }
        Returns: Json
      }
      get_my_club_id: { Args: never; Returns: string }
      is_staff_of_club: { Args: { target_club_id: string }; Returns: boolean }
      parental_consent_reminders: { Args: never; Returns: undefined }
      rectification_sla_check: { Args: never; Returns: undefined }
      reset_stale_processing_notifications: {
        Args: { stale_minutes?: number }
        Returns: number
      }
      schedule_session_pushes_job: { Args: never; Returns: undefined }
      send_push_job: { Args: never; Returns: undefined }
      set_current_season: { Args: { p_season_id: string }; Returns: undefined }
      upsert_player_positions: {
        Args: { p_player_id: string; p_positions: Json }
        Returns: undefined
      }
      user_role: { Args: never; Returns: string }
      uuidv7: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
