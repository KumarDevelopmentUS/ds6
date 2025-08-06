export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          author_avatar_background_color: string | null
          author_avatar_icon: string | null
          author_avatar_icon_color: string | null
          author_name: string | null
          content: string
          created_at: string | null
          id: number
          parent_comment_id: number | null
          post_id: number | null
          user_id: string | null
        }
        Insert: {
          author_avatar_background_color?: string | null
          author_avatar_icon?: string | null
          author_avatar_icon_color?: string | null
          author_name?: string | null
          content: string
          created_at?: string | null
          id?: number
          parent_comment_id?: number | null
          post_id?: number | null
          user_id?: string | null
        }
        Update: {
          author_avatar_background_color?: string | null
          author_avatar_icon?: string | null
          author_avatar_icon_color?: string | null
          author_name?: string | null
          content?: string
          created_at?: string | null
          id?: number
          parent_comment_id?: number | null
          post_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string | null
          id: number
          status: string | null
          user_id_1: string
          user_id_2: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          status?: string | null
          user_id_1: string
          user_id_2: string
        }
        Update: {
          created_at?: string | null
          id?: number
          status?: string | null
          user_id_1?: string
          user_id_2?: string
        }
        Relationships: []
      }
      live_matches: {
        Row: {
          createdAt: string | null
          hostId: string | null
          id: string
          livePlayerStats: Json
          liveTeamPenalties: Json
          matchSetup: Json
          matchStartTime: string | null
          participants: string[] | null
          roomCode: string
          status: string | null
          userSlotMap: Json | null
          winnerTeam: number | null
        }
        Insert: {
          createdAt?: string | null
          hostId?: string | null
          id?: string
          livePlayerStats: Json
          liveTeamPenalties: Json
          matchSetup: Json
          matchStartTime?: string | null
          participants?: string[] | null
          roomCode: string
          status?: string | null
          userSlotMap?: Json | null
          winnerTeam?: number | null
        }
        Update: {
          createdAt?: string | null
          hostId?: string | null
          id?: string
          livePlayerStats?: Json
          liveTeamPenalties?: Json
          matchSetup?: Json
          matchStartTime?: string | null
          participants?: string[] | null
          roomCode?: string
          status?: string | null
          userSlotMap?: Json | null
          winnerTeam?: number | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_avatar_background_color: string | null
          author_avatar_icon: string | null
          author_avatar_icon_color: string | null
          author_name: string | null
          community_id: number | null
          content: string | null
          created_at: string | null
          id: number
          image_url: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          author_avatar_background_color?: string | null
          author_avatar_icon?: string | null
          author_avatar_icon_color?: string | null
          author_name?: string | null
          community_id?: number | null
          content?: string | null
          created_at?: string | null
          id?: number
          image_url?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          author_avatar_background_color?: string | null
          author_avatar_icon?: string | null
          author_avatar_icon_color?: string | null
          author_name?: string | null
          community_id?: number | null
          content?: string | null
          created_at?: string | null
          id?: number
          image_url?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_background_color: string | null
          avatar_icon: string | null
          avatar_icon_color: string | null
          created_at: string
          first_name: string | null
          id: string
          nickname: string | null
          school: string | null
          user_id: string | null
        }
        Insert: {
          avatar_background_color?: string | null
          avatar_icon?: string | null
          avatar_icon_color?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          nickname?: string | null
          school?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_background_color?: string | null
          avatar_icon?: string | null
          avatar_icon_color?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          nickname?: string | null
          school?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      saved_matches: {
        Row: {
          createdAt: string | null
          id: string
          matchDuration: number | null
          matchSetup: Json
          matchStartTime: string | null
          playerStats: Json
          roomCode: string | null
          teamPenalties: Json
          userId: string
          userSlotMap: Json | null
          winnerTeam: number | null
        }
        Insert: {
          createdAt?: string | null
          id?: string
          matchDuration?: number | null
          matchSetup: Json
          matchStartTime?: string | null
          playerStats: Json
          roomCode?: string | null
          teamPenalties: Json
          userId: string
          userSlotMap?: Json | null
          winnerTeam?: number | null
        }
        Update: {
          createdAt?: string | null
          id?: string
          matchDuration?: number | null
          matchSetup?: Json
          matchStartTime?: string | null
          playerStats?: Json
          roomCode?: string | null
          teamPenalties?: Json
          userId?: string
          userSlotMap?: Json | null
          winnerTeam?: number | null
        }
        Relationships: []
      }
      user_communities: {
        Row: {
          community_id: number | null
          id: number
          joined_at: string | null
          user_id: string | null
        }
        Insert: {
          community_id?: number | null
          id?: number
          joined_at?: string | null
          user_id?: string | null
        }
        Update: {
          community_id?: number | null
          id?: number
          joined_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_communities_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          achievements: string[] | null
          avatar_url: string | null
          average_rating: number | null
          best_rating: number | null
          created_at: string | null
          display_name: string | null
          id: string
          notification_settings: Json | null
          preferred_theme: string | null
          total_hits: number | null
          total_matches_played: number | null
          total_throws: number | null
          total_wins: number | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          achievements?: string[] | null
          avatar_url?: string | null
          average_rating?: number | null
          best_rating?: number | null
          created_at?: string | null
          display_name?: string | null
          id: string
          notification_settings?: Json | null
          preferred_theme?: string | null
          total_hits?: number | null
          total_matches_played?: number | null
          total_throws?: number | null
          total_wins?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          achievements?: string[] | null
          avatar_url?: string | null
          average_rating?: number | null
          best_rating?: number | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          notification_settings?: Json | null
          preferred_theme?: string | null
          total_hits?: number | null
          total_matches_played?: number | null
          total_throws?: number | null
          total_wins?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string | null
          id: number
          post_id: number | null
          user_id: string
          vote_type: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          post_id?: number | null
          user_id: string
          vote_type?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          post_id?: number | null
          user_id?: string
          vote_type?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_user_achievements: {
        Args: { user_uuid: string }
        Returns: string[]
      }
      cleanup_old_live_matches: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_friends_of_friends: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          username: string
          nickname: string
          school: string
          avatar_icon: string
          avatar_icon_color: string
          avatar_background_color: string
        }[]
      }
      get_mutual_friends: {
        Args: { user_a_id: string; user_b_id: string }
        Returns: {
          id: string
          username: string
          nickname: string
          school: string
          avatar_icon: string
          avatar_icon_color: string
          avatar_background_color: string
        }[]
      }
      get_posts_with_counts: {
        Args: { community_id_param?: number }
        Returns: {
          id: number
          title: string
          content: string
          created_at: string
          image_url: string
          like_count: number
          comment_count: number
          user_id: string
          community_id: number
          author_name: string
          author_avatar_icon: string
          author_avatar_icon_color: string
          author_avatar_background_color: string
          username: string
        }[]
      }
      get_schoolmates: {
        Args: { user_id: string }
        Returns: {
          id: string
          username: string
          nickname: string
          school: string
          avatar_icon: string
          avatar_icon_color: string
          avatar_background_color: string
        }[]
      }
      get_user_stats: {
        Args: { p_user_id: string }
        Returns: {
          total_matches: number
          total_wins: number
          win_rate: number
          total_throws: number
          total_hits: number
          hit_rate: number
          total_catches: number
          catch_rate: number
          avg_score: number
        }[]
      }
      get_user_vote: {
        Args: { post_id_param: number; user_id_param: string }
        Returns: number
      }
    }
    Enums: {
      match_status: "waiting" | "active" | "finished"
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
      match_status: ["waiting", "active", "finished"],
    },
  },
} as const
