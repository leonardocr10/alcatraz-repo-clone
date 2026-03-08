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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      boss_notification_log: {
        Row: {
          boss_id: string
          id: string
          notification_key: string
          schedule_id: string
          sent_at: string
        }
        Insert: {
          boss_id: string
          id?: string
          notification_key: string
          schedule_id: string
          sent_at?: string
        }
        Update: {
          boss_id?: string
          id?: string
          notification_key?: string
          schedule_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boss_notification_log_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "bosses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boss_notification_log_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "boss_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      boss_schedules: {
        Row: {
          boss_id: string
          created_at: string
          id: string
          notify_minutes_before: number
          spawn_time: string
        }
        Insert: {
          boss_id: string
          created_at?: string
          id?: string
          notify_minutes_before?: number
          spawn_time: string
        }
        Update: {
          boss_id?: string
          created_at?: string
          id?: string
          notify_minutes_before?: number
          spawn_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "boss_schedules_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "bosses"
            referencedColumns: ["id"]
          },
        ]
      }
      bosses: {
        Row: {
          created_at: string
          description: string | null
          drops: string | null
          id: string
          image_url: string | null
          map_image_url: string | null
          map_level: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          drops?: string | null
          id?: string
          image_url?: string | null
          map_image_url?: string | null
          map_level?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          drops?: string | null
          id?: string
          image_url?: string | null
          map_image_url?: string | null
          map_level?: string | null
          name?: string
        }
        Relationships: []
      }
      character_classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: Database["public"]["Enums"]["character_class"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: Database["public"]["Enums"]["character_class"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: Database["public"]["Enums"]["character_class"]
        }
        Relationships: []
      }
      clan_rules: {
        Row: {
          content: string
          id: string
          updated_at: string
        }
        Insert: {
          content?: string
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_rankings: {
        Row: {
          clan: string | null
          game_class: string | null
          id: string
          level: number | null
          nickname: string
          rank_position: number | null
          updated_at: string
          user_id: string
          xp: string | null
        }
        Insert: {
          clan?: string | null
          game_class?: string | null
          id?: string
          level?: number | null
          nickname: string
          rank_position?: number | null
          updated_at?: string
          user_id: string
          xp?: string | null
        }
        Update: {
          clan?: string | null
          game_class?: string | null
          id?: string
          level?: number | null
          nickname?: string
          rank_position?: number | null
          updated_at?: string
          user_id?: string
          xp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_rankings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          name?: string
        }
        Relationships: []
      }
      roulette_numbers_used: {
        Row: {
          created_at: string
          id: string
          item_id: string
          number: number
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          number: number
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          number?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_numbers_used_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roulette_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_numbers_used_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roulette_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_numbers_used_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_plays: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          item_id: string
          number: number
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          item_id: string
          number: number
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          item_id?: string
          number?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_plays_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roulette_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_plays_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roulette_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_plays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_session_items: {
        Row: {
          closed_at: string | null
          id: string
          is_open: boolean
          item_id: string
          order_index: number
          round_duration_seconds: number
          round_ends_at: string | null
          round_started_at: string | null
          session_id: string
          winner_number: number | null
          winner_user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          id?: string
          is_open?: boolean
          item_id: string
          order_index: number
          round_duration_seconds?: number
          round_ends_at?: string | null
          round_started_at?: string | null
          session_id: string
          winner_number?: number | null
          winner_user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          id?: string
          is_open?: boolean
          item_id?: string
          order_index?: number
          round_duration_seconds?: number
          round_ends_at?: string | null
          round_started_at?: string | null
          session_id?: string
          winner_number?: number | null
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roulette_session_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roulette_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roulette_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_session_items_winner_user_id_fkey"
            columns: ["winner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_sessions: {
        Row: {
          created_by: string | null
          current_item_index: number
          ended_at: string | null
          id: string
          is_running: boolean
          name: string
          started_at: string | null
        }
        Insert: {
          created_by?: string | null
          current_item_index?: number
          ended_at?: string | null
          id?: string
          is_running?: boolean
          name: string
          started_at?: string | null
        }
        Update: {
          created_by?: string | null
          current_item_index?: number
          ended_at?: string | null
          id?: string
          is_running?: boolean
          name?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roulette_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_winners: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          created_at: string
          id: string
          item_id: string
          number: number
          session_id: string
          user_id: string
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          created_at?: string
          id?: string
          item_id: string
          number: number
          session_id: string
          user_id: string
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          created_at?: string
          id?: string
          item_id?: string
          number?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_winners_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roulette_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_winners_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roulette_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_winners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          approved: boolean
          auth_id: string | null
          clan_role: string | null
          class: Database["public"]["Enums"]["character_class"] | null
          created_at: string
          email: string | null
          id: string
          nickname: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          whatsapp_optout: boolean
        }
        Insert: {
          approved?: boolean
          auth_id?: string | null
          clan_role?: string | null
          class?: Database["public"]["Enums"]["character_class"] | null
          created_at?: string
          email?: string | null
          id?: string
          nickname: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          whatsapp_optout?: boolean
        }
        Update: {
          approved?: boolean
          auth_id?: string | null
          clan_role?: string | null
          class?: Database["public"]["Enums"]["character_class"] | null
          created_at?: string
          email?: string | null
          id?: string
          nickname?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          whatsapp_optout?: boolean
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          allow_user_optout: boolean
          api_url: string
          body_template: string
          headers: Json
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          allow_user_optout?: boolean
          api_url?: string
          body_template?: string
          headers?: Json
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          allow_user_optout?: boolean
          api_url?: string
          body_template?: string
          headers?: Json
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_signup_profile: {
        Args: { _auth_id: string }
        Returns: boolean
      }
      get_user_id: { Args: { _auth_id: string }; Returns: string }
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
      character_class:
        | "Fighter"
        | "Mechanician"
        | "Archer"
        | "Pikeman"
        | "Knight"
        | "Atalanta"
        | "Priestess"
        | "Magician"
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
      character_class: [
        "Fighter",
        "Mechanician",
        "Archer",
        "Pikeman",
        "Knight",
        "Atalanta",
        "Priestess",
        "Magician",
      ],
    },
  },
} as const
