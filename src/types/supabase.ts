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
      calendar_events: {
        Row: {
          category_id: string | null
          color: string | null
          cpbl_game_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          end_time: string
          event_type: string | null
          family_id: string | null
          id: string
          is_all_day: boolean | null
          recurrence: string | null
          start_date: string | null
          start_time: string
          title: string
          visibility: string
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          cpbl_game_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time: string
          event_type?: string | null
          family_id?: string | null
          id?: string
          is_all_day?: boolean | null
          recurrence?: string | null
          start_date?: string | null
          start_time: string
          title: string
          visibility?: string
        }
        Update: {
          category_id?: string | null
          color?: string | null
          cpbl_game_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string
          event_type?: string | null
          family_id?: string | null
          id?: string
          is_all_day?: boolean | null
          recurrence?: string | null
          start_date?: string | null
          start_time?: string
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_cpbl_game_id_fkey"
            columns: ["cpbl_game_id"]
            isOneToOne: false
            referencedRelation: "cpbl_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      camping_gear: {
        Row: {
          base_usage_count: number | null
          brand: string | null
          category: string | null
          cost: number | null
          created_at: string
          family_id: string | null
          id: number
          image_url: string | null
          name: string
          rental_price: number | null
          type: string | null
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          base_usage_count?: number | null
          brand?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          family_id?: string | null
          id?: number
          image_url?: string | null
          name: string
          rental_price?: number | null
          type?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          base_usage_count?: number | null
          brand?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          family_id?: string | null
          id?: number
          image_url?: string | null
          name?: string
          rental_price?: number | null
          type?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camping_gear_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      camping_trips: {
        Row: {
          altitude: number | null
          campsite_id: number | null
          campsite_name: string | null
          cleanliness: number | null
          companions: string | null
          cost: number | null
          created_at: string | null
          duration_days: number | null
          entertainment: string | null
          family_id: string | null
          has_tarp: boolean | null
          id: number
          is_rainy: boolean | null
          is_wet_tent: boolean | null
          is_windy: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          merged_into_id: number | null
          night_rush: boolean | null
          notes: string | null
          owner_friendliness: string | null
          price: number | null
          rating: number | null
          road_condition: number | null
          scenery: number | null
          start_latitude: number | null
          start_location: string | null
          start_longitude: number | null
          status: string | null
          tarp_id: number | null
          tent_id: number | null
          tent_type: string | null
          trip_date: string
          user_id: string | null
          visibility: string
          zone: string | null
        }
        Insert: {
          altitude?: number | null
          campsite_id?: number | null
          campsite_name?: string | null
          cleanliness?: number | null
          companions?: string | null
          cost?: number | null
          created_at?: string | null
          duration_days?: number | null
          entertainment?: string | null
          family_id?: string | null
          has_tarp?: boolean | null
          id?: number
          is_rainy?: boolean | null
          is_wet_tent?: boolean | null
          is_windy?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          merged_into_id?: number | null
          night_rush?: boolean | null
          notes?: string | null
          owner_friendliness?: string | null
          price?: number | null
          rating?: number | null
          road_condition?: number | null
          scenery?: number | null
          start_latitude?: number | null
          start_location?: string | null
          start_longitude?: number | null
          status?: string | null
          tarp_id?: number | null
          tent_id?: number | null
          tent_type?: string | null
          trip_date: string
          user_id?: string | null
          visibility?: string
          zone?: string | null
        }
        Update: {
          altitude?: number | null
          campsite_id?: number | null
          campsite_name?: string | null
          cleanliness?: number | null
          companions?: string | null
          cost?: number | null
          created_at?: string | null
          duration_days?: number | null
          entertainment?: string | null
          family_id?: string | null
          has_tarp?: boolean | null
          id?: number
          is_rainy?: boolean | null
          is_wet_tent?: boolean | null
          is_windy?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          merged_into_id?: number | null
          night_rush?: boolean | null
          notes?: string | null
          owner_friendliness?: string | null
          price?: number | null
          rating?: number | null
          road_condition?: number | null
          scenery?: number | null
          start_latitude?: number | null
          start_location?: string | null
          start_longitude?: number | null
          status?: string | null
          tarp_id?: number | null
          tent_id?: number | null
          tent_type?: string | null
          trip_date?: string
          user_id?: string | null
          visibility?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camping_trips_campsite_id_fkey"
            columns: ["campsite_id"]
            isOneToOne: false
            referencedRelation: "campsites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camping_trips_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camping_trips_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "camping_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camping_trips_tarp_id_fkey"
            columns: ["tarp_id"]
            isOneToOne: false
            referencedRelation: "camping_gear"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camping_trips_tent_id_fkey"
            columns: ["tent_id"]
            isOneToOne: false
            referencedRelation: "camping_gear"
            referencedColumns: ["id"]
          },
        ]
      }
      campsites: {
        Row: {
          address: string | null
          altitude: number | null
          amenities: Json | null
          booking_available_until: string | null
          booking_difficulty: string | null
          booking_last_available_date: string | null
          booking_method: string[] | null
          booking_platform: string | null
          booking_platform_url: string | null
          booking_scraped_at: string | null
          booking_timing: string | null
          business_status: string | null
          campsite_notes: string | null
          capacity_zones: Json | null
          check_in_time: string | null
          check_out_time: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          district: string | null
          field_sources: Json
          google_maps_url: string | null
          google_place_id: string | null
          id: number
          is_verified: boolean | null
          latitude: number | null
          layout_image_url: string | null
          longitude: number | null
          merged_into_id: number | null
          name: string
          night_rush_time: string | null
          phone: string | null
          playground_features: string[] | null
          recommended_spots: string | null
          scenery_features: string[] | null
          shower_restrictions: string | null
          spot_types: string[] | null
          tags: string[] | null
          total_capacity: number | null
          water_features: string[] | null
          zone_config: string | null
        }
        Insert: {
          address?: string | null
          altitude?: number | null
          amenities?: Json | null
          booking_available_until?: string | null
          booking_difficulty?: string | null
          booking_last_available_date?: string | null
          booking_method?: string[] | null
          booking_platform?: string | null
          booking_platform_url?: string | null
          booking_scraped_at?: string | null
          booking_timing?: string | null
          business_status?: string | null
          campsite_notes?: string | null
          capacity_zones?: Json | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          district?: string | null
          field_sources?: Json
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: number
          is_verified?: boolean | null
          latitude?: number | null
          layout_image_url?: string | null
          longitude?: number | null
          merged_into_id?: number | null
          name: string
          night_rush_time?: string | null
          phone?: string | null
          playground_features?: string[] | null
          recommended_spots?: string | null
          scenery_features?: string[] | null
          shower_restrictions?: string | null
          spot_types?: string[] | null
          tags?: string[] | null
          total_capacity?: number | null
          water_features?: string[] | null
          zone_config?: string | null
        }
        Update: {
          address?: string | null
          altitude?: number | null
          amenities?: Json | null
          booking_available_until?: string | null
          booking_difficulty?: string | null
          booking_last_available_date?: string | null
          booking_method?: string[] | null
          booking_platform?: string | null
          booking_platform_url?: string | null
          booking_scraped_at?: string | null
          booking_timing?: string | null
          business_status?: string | null
          campsite_notes?: string | null
          capacity_zones?: Json | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          district?: string | null
          field_sources?: Json
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: number
          is_verified?: boolean | null
          latitude?: number | null
          layout_image_url?: string | null
          longitude?: number | null
          merged_into_id?: number | null
          name?: string
          night_rush_time?: string | null
          phone?: string | null
          playground_features?: string[] | null
          recommended_spots?: string | null
          scenery_features?: string[] | null
          shower_restrictions?: string | null
          spot_types?: string[] | null
          tags?: string[] | null
          total_capacity?: number | null
          water_features?: string[] | null
          zone_config?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campsites_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "campsites"
            referencedColumns: ["id"]
          },
        ]
      }
      cpbl_schedule: {
        Row: {
          created_at: string | null
          field_abbe: string
          game_date: string
          game_sno: number
          home_team_name: string
          id: string
          visiting_team_name: string
        }
        Insert: {
          created_at?: string | null
          field_abbe: string
          game_date: string
          game_sno: number
          home_team_name: string
          id?: string
          visiting_team_name: string
        }
        Update: {
          created_at?: string | null
          field_abbe?: string
          game_date?: string
          game_sno?: number
          home_team_name?: string
          id?: string
          visiting_team_name?: string
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          owner_id: string
          sort_order: number
          system_key: string | null
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          sort_order?: number
          system_key?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          sort_order?: number
          system_key?: string | null
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      family_list_items: {
        Row: {
          created_at: string
          created_by: string | null
          done: boolean
          done_at: string | null
          done_by: string | null
          id: string
          list_id: string
          sort_order: number
          text: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          list_id: string
          sort_order?: number
          text: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          list_id?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "family_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      family_lists: {
        Row: {
          created_at: string
          created_by: string | null
          family_id: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          family_id: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          family_id?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_lists_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          campsite_quick_chips: string[] | null
          family_id: string | null
          id: string
          is_admin: boolean | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          onboarding_completed_at: string | null
          show_cpbl: boolean
          updated_at: string | null
        }
        Insert: {
          campsite_quick_chips?: string[] | null
          family_id?: string | null
          id: string
          is_admin?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          onboarding_completed_at?: string | null
          show_cpbl?: boolean
          updated_at?: string | null
        }
        Update: {
          campsite_quick_chips?: string[] | null
          family_id?: string | null
          id?: string
          is_admin?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          onboarding_completed_at?: string | null
          show_cpbl?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      system_assets: {
        Row: {
          brand: string | null
          created_at: string
          height: number | null
          id: number
          name: string | null
          public_id: string | null
          type: string
          url: string
          width: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          height?: number | null
          id?: number
          name?: string | null
          public_id?: string | null
          type: string
          url: string
          width?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          height?: number | null
          id?: number
          name?: string | null
          public_id?: string | null
          type?: string
          url?: string
          width?: number | null
        }
        Relationships: []
      }
      trip_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          height: number | null
          id: number
          public_id: string | null
          trip_id: number
          url: string
          user_id: string
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          height?: number | null
          id?: never
          public_id?: string | null
          trip_id: number
          url: string
          user_id: string
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          height?: number | null
          id?: never
          public_id?: string | null
          trip_id?: number
          url?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_photos_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "camping_trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
      }
      family_member_ids: { Args: never; Returns: string[] }
      get_family_by_invite: { Args: { code: string }; Returns: Json }
      get_family_by_invite_code: {
        Args: { code_input: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          id: string
          invite_code: string
          name: string
        }[]
        SetofOptions: {
          from: "*"
          to: "families"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_family_members: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          family_id: string
          id: string
          is_head: boolean
          name: string
        }[]
      }
      join_family_by_code: { Args: { code_input: string }; Returns: string }
      kick_family_member: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      leave_family: { Args: never; Returns: undefined }
      user_family_id: { Args: never; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
