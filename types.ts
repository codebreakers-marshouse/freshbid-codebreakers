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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Relationships: []
      }
      bids: {
        Row: {
          amount: number
          buyer_id: string
          charity_id: string | null
          created_at: string
          effective_score: number | null
          id: string
          lot_id: string
          pickup_reliability: number
          quantity_requested: number | null
          status: Database["public"]["Enums"]["bid_status"]
        }
        Insert: {
          amount: number
          buyer_id: string
          charity_id?: string | null
          created_at?: string
          effective_score?: number | null
          id?: string
          lot_id: string
          pickup_reliability?: number
          quantity_requested?: number | null
          status?: Database["public"]["Enums"]["bid_status"]
        }
        Update: {
          amount?: number
          buyer_id?: string
          charity_id?: string | null
          created_at?: string
          effective_score?: number | null
          id?: string
          lot_id?: string
          pickup_reliability?: number
          quantity_requested?: number | null
          status?: Database["public"]["Enums"]["bid_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bids_charity_id_fkey"
            columns: ["charity_id"]
            isOneToOne: false
            referencedRelation: "charities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "surplus_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      charities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          registration_no: string | null
          verified: boolean
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          registration_no?: string | null
          verified?: boolean
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          registration_no?: string | null
          verified?: boolean
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charities_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount: number
          bid_id: string | null
          buyer_id: string
          charity_id: string | null
          created_at: string
          credited_in_name_of: string | null
          id: string
          lot_id: string | null
          meals_estimated: number | null
        }
        Insert: {
          amount: number
          bid_id?: string | null
          buyer_id: string
          charity_id?: string | null
          created_at?: string
          credited_in_name_of?: string | null
          id?: string
          lot_id?: string | null
          meals_estimated?: number | null
        }
        Update: {
          amount?: number
          bid_id?: string | null
          buyer_id?: string
          charity_id?: string | null
          created_at?: string
          credited_in_name_of?: string | null
          id?: string
          lot_id?: string | null
          meals_estimated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_charity_id_fkey"
            columns: ["charity_id"]
            isOneToOne: false
            referencedRelation: "charities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "surplus_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_name: string | null
          trust_score: number
          updated_at: string
          verified: boolean
          zone_id: string | null
        }
        Insert: {
          account_type?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          org_name?: string | null
          trust_score?: number
          updated_at?: string
          verified?: boolean
          zone_id?: string | null
        }
        Update: {
          account_type?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_name?: string | null
          trust_score?: number
          updated_at?: string
          verified?: boolean
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      surplus_lots: {
        Row: {
          allergens: string[]
          allow_partial: boolean
          category: Database["public"]["Enums"]["food_category"]
          closes_at: string
          created_at: string
          current_price: number
          expiry_at: string
          id: string
          packaging: string | null
          pickup_end: string
          pickup_start: string
          pickup_success_prob: number | null
          predicted_surplus: number | null
          predicted_value: number | null
          quantity: number
          reserve_price: number
          status: Database["public"]["Enums"]["lot_status"]
          supplier_id: string
          temp_sensitivity: Database["public"]["Enums"]["temp_sensitivity"]
          title: string
          total_inventory: number | null
          unit: string
          updated_at: string
          winning_bid_id: string | null
          zone_id: string | null
        }
        Insert: {
          allergens?: string[]
          allow_partial?: boolean
          category?: Database["public"]["Enums"]["food_category"]
          closes_at?: string
          created_at?: string
          current_price?: number
          expiry_at: string
          id?: string
          packaging?: string | null
          pickup_end: string
          pickup_start: string
          pickup_success_prob?: number | null
          predicted_surplus?: number | null
          predicted_value?: number | null
          quantity?: number
          reserve_price?: number
          status?: Database["public"]["Enums"]["lot_status"]
          supplier_id: string
          temp_sensitivity?: Database["public"]["Enums"]["temp_sensitivity"]
          title: string
          total_inventory?: number | null
          unit?: string
          updated_at?: string
          winning_bid_id?: string | null
          zone_id?: string | null
        }
        Update: {
          allergens?: string[]
          allow_partial?: boolean
          category?: Database["public"]["Enums"]["food_category"]
          closes_at?: string
          created_at?: string
          current_price?: number
          expiry_at?: string
          id?: string
          packaging?: string | null
          pickup_end?: string
          pickup_start?: string
          pickup_success_prob?: number | null
          predicted_surplus?: number | null
          predicted_value?: number | null
          quantity?: number
          reserve_price?: number
          status?: Database["public"]["Enums"]["lot_status"]
          supplier_id?: string
          temp_sensitivity?: Database["public"]["Enums"]["temp_sensitivity"]
          title?: string
          total_inventory?: number | null
          unit?: string
          updated_at?: string
          winning_bid_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surplus_lots_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
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
      zones: {
        Row: {
          center_lat: number
          center_lng: number
          city: string
          created_at: string
          id: string
          name: string
          radius_km: number
        }
        Insert: {
          center_lat: number
          center_lng: number
          city: string
          created_at?: string
          id?: string
          name: string
          radius_km?: number
        }
        Update: {
          center_lat?: number
          center_lng?: number
          city?: string
          created_at?: string
          id?: string
          name?: string
          radius_km?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supplier" | "buyer" | "logistics"
      bid_status: "active" | "outbid" | "won" | "lost" | "withdrawn"
      food_category:
        | "bakery"
        | "produce"
        | "dairy"
        | "prepared"
        | "meat"
        | "frozen"
        | "pantry"
        | "beverage"
        | "other"
      lot_status:
        | "draft"
        | "open"
        | "closing"
        | "awarded"
        | "completed"
        | "failed"
        | "cancelled"
      temp_sensitivity: "ambient" | "chilled" | "frozen" | "hot"
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
      app_role: ["admin", "supplier", "buyer", "logistics"],
      bid_status: ["active", "outbid", "won", "lost", "withdrawn"],
      food_category: [
        "bakery",
        "produce",
        "dairy",
        "prepared",
        "meat",
        "frozen",
        "pantry",
        "beverage",
        "other",
      ],
      lot_status: [
        "draft",
        "open",
        "closing",
        "awarded",
        "completed",
        "failed",
        "cancelled",
      ],
      temp_sensitivity: ["ambient", "chilled", "frozen", "hot"],
    },
  },
} as const
