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
  public: {
    Tables: {
      groups: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      knockout_predictions: {
        Row: {
          created_at: string
          id: string
          points_awarded: number
          reached_phase: Database["public"]["Enums"]["match_phase"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_awarded?: number
          reached_phase: Database["public"]["Enums"]["match_phase"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_awarded?: number
          reached_phase?: Database["public"]["Enums"]["match_phase"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knockout_predictions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          advancing_team_id: string | null
          away_score: number | null
          away_team_id: string | null
          group_id: string | null
          home_score: number | null
          home_team_id: string | null
          id: string
          is_finished: boolean
          match_date: string | null
          match_number: number
          phase: Database["public"]["Enums"]["match_phase"]
          round_label: string
        }
        Insert: {
          advancing_team_id?: string | null
          away_score?: number | null
          away_team_id?: string | null
          group_id?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          is_finished?: boolean
          match_date?: string | null
          match_number: number
          phase: Database["public"]["Enums"]["match_phase"]
          round_label: string
        }
        Update: {
          advancing_team_id?: string | null
          away_score?: number | null
          away_team_id?: string | null
          group_id?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          is_finished?: boolean
          match_date?: string | null
          match_number?: number
          phase?: Database["public"]["Enums"]["match_phase"]
          round_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_advancing_team_id_fkey"
            columns: ["advancing_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          advancing_team_id: string | null
          away_score: number
          created_at: string
          home_score: number
          id: string
          match_id: string
          points_awarded: number
          updated_at: string
          user_id: string
        }
        Insert: {
          advancing_team_id?: string | null
          away_score: number
          created_at?: string
          home_score: number
          id?: string
          match_id: string
          points_awarded?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          advancing_team_id?: string | null
          away_score?: number
          created_at?: string
          home_score?: number
          id?: string
          match_id?: string
          points_awarded?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_advancing_team_id_fkey"
            columns: ["advancing_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          description: string | null
          id: string
          label: string
          points: number
          rule_key: string
        }
        Insert: {
          description?: string | null
          id?: string
          label: string
          points: number
          rule_key: string
        }
        Update: {
          description?: string | null
          id?: string
          label?: string
          points?: number
          rule_key?: string
        }
        Relationships: []
      }
      special_predictions: {
        Row: {
          best_goalkeeper: string | null
          best_player: string | null
          champion_team_id: string | null
          created_at: string
          id: string
          points_awarded: number
          top_scorer: string | null
          underdog_team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_goalkeeper?: string | null
          best_player?: string | null
          champion_team_id?: string | null
          created_at?: string
          id?: string
          points_awarded?: number
          top_scorer?: string | null
          underdog_team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_goalkeeper?: string | null
          best_player?: string | null
          champion_team_id?: string | null
          created_at?: string
          id?: string
          points_awarded?: number
          top_scorer?: string | null
          underdog_team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_predictions_champion_team_id_fkey"
            columns: ["champion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_predictions_underdog_team_id_fkey"
            columns: ["underdog_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_official_results: {
        Row: {
          group_position: number | null
          reached_phase: Database["public"]["Enums"]["match_phase"] | null
          team_id: string
        }
        Insert: {
          group_position?: number | null
          reached_phase?: Database["public"]["Enums"]["match_phase"] | null
          team_id: string
        }
        Update: {
          group_position?: number | null
          reached_phase?: Database["public"]["Enums"]["match_phase"] | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_official_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          code: string
          fifa_rank: number | null
          flag: string
          group_id: string
          id: string
          is_top15: boolean
          name: string
        }
        Insert: {
          code: string
          fifa_rank?: number | null
          flag: string
          group_id: string
          id?: string
          is_top15?: boolean
          name: string
        }
        Update: {
          code?: string
          fifa_rank?: number | null
          flag?: string
          group_id?: string
          id?: string
          is_top15?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_settings: {
        Row: {
          community_predictions_visible: boolean
          current_phase: Database["public"]["Enums"]["tournament_phase"]
          group_picks_locked: boolean
          id: number
          knockout_picks_locked: boolean
          special_picks_locked: boolean
        }
        Insert: {
          community_predictions_visible?: boolean
          current_phase?: Database["public"]["Enums"]["tournament_phase"]
          group_picks_locked?: boolean
          id?: number
          knockout_picks_locked?: boolean
          special_picks_locked?: boolean
        }
        Update: {
          community_predictions_visible?: boolean
          current_phase?: Database["public"]["Enums"]["tournament_phase"]
          group_picks_locked?: boolean
          id?: number
          knockout_picks_locked?: boolean
          special_picks_locked?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_ranking: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          total_pts: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      match_phase: "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final"
      tournament_phase: "groups" | "knockout" | "finished"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
      match_phase: ["group", "r32", "r16", "qf", "sf", "third", "final"],
      tournament_phase: ["groups", "knockout", "finished"],
    },
  },
} as const
