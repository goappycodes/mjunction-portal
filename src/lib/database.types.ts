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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      call_attempts: {
        Row: {
          agent_id: string | null
          agent_note: string | null
          attempt_number: number
          call_type: Database["public"]["Enums"]["call_type"]
          caller_type: Database["public"]["Enums"]["caller_type"]
          created_at: string
          dtmf_response: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          language: string | null
          language_defaulted: boolean
          outcome: Database["public"]["Enums"]["call_outcome"] | null
          provider: string
          provider_call_ref: string | null
          provider_status: string | null
          recipient_id: string
          recording_url: string | null
          started_at: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_note?: string | null
          attempt_number?: number
          call_type: Database["public"]["Enums"]["call_type"]
          caller_type?: Database["public"]["Enums"]["caller_type"]
          created_at?: string
          dtmf_response?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          language?: string | null
          language_defaulted?: boolean
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          provider?: string
          provider_call_ref?: string | null
          provider_status?: string | null
          recipient_id: string
          recording_url?: string | null
          started_at?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_note?: string | null
          attempt_number?: number
          call_type?: Database["public"]["Enums"]["call_type"]
          caller_type?: Database["public"]["Enums"]["caller_type"]
          created_at?: string
          dtmf_response?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          language?: string | null
          language_defaulted?: boolean
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          provider?: string
          provider_call_ref?: string | null
          provider_status?: string | null
          recipient_id?: string
          recording_url?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_attempts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_attempts_language_fkey"
            columns: ["language"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "call_attempts_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatches: {
        Row: {
          awb_number: string | null
          courier_name: string | null
          created_at: string
          created_by: string | null
          delivered_date: string | null
          dispatch_date: string | null
          id: string
          recipient_id: string
        }
        Insert: {
          awb_number?: string | null
          courier_name?: string | null
          created_at?: string
          created_by?: string | null
          delivered_date?: string | null
          dispatch_date?: string | null
          id?: string
          recipient_id: string
        }
        Update: {
          awb_number?: string | null
          courier_name?: string | null
          created_at?: string
          created_by?: string | null
          delivered_date?: string | null
          dispatch_date?: string | null
          id?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: true
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          duplicate_count: number | null
          error_count: number | null
          file_name: string | null
          id: string
          row_count: number | null
          uploaded_by: string | null
          valid_count: number | null
        }
        Insert: {
          created_at?: string
          duplicate_count?: number | null
          error_count?: number | null
          file_name?: string | null
          id?: string
          row_count?: number | null
          uploaded_by?: string | null
          valid_count?: number | null
        }
        Update: {
          created_at?: string
          duplicate_count?: number | null
          error_count?: number | null
          file_name?: string | null
          id?: string
          row_count?: number | null
          uploaded_by?: string | null
          valid_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ivr_call_events: {
        Row: {
          applet_hint: string | null
          call_sid: string
          created_at: string
          id: number
          status: string | null
          step: string | null
          user_input: string | null
        }
        Insert: {
          applet_hint?: string | null
          call_sid: string
          created_at?: string
          id?: number
          status?: string | null
          step?: string | null
          user_input?: string | null
        }
        Update: {
          applet_hint?: string | null
          call_sid?: string
          created_at?: string
          id?: number
          status?: string | null
          step?: string | null
          user_input?: string | null
        }
        Relationships: []
      }
      ivr_logs: {
        Row: {
          call_attempt_id: string | null
          call_sid: string
          caller_number: string | null
          created_at: string
          id: number
          order_id: string | null
          status: string | null
          step: string | null
          updated_at: string
          user_input: string | null
        }
        Insert: {
          call_attempt_id?: string | null
          call_sid: string
          caller_number?: string | null
          created_at?: string
          id?: number
          order_id?: string | null
          status?: string | null
          step?: string | null
          updated_at?: string
          user_input?: string | null
        }
        Update: {
          call_attempt_id?: string | null
          call_sid?: string
          caller_number?: string | null
          created_at?: string
          id?: number
          order_id?: string | null
          status?: string | null
          step?: string | null
          updated_at?: string
          user_input?: string | null
        }
        Relationships: []
      }
      ivr_request_log: {
        Row: {
          call_sid: string | null
          created_at: string
          direction: string
          duration_ms: number | null
          error: string | null
          event: string | null
          fn: string
          id: string
          level: string | null
          message: string | null
          method: string | null
          order_id: string | null
          payload: Json | null
          status: number | null
          url: string | null
        }
        Insert: {
          call_sid?: string | null
          created_at?: string
          direction: string
          duration_ms?: number | null
          error?: string | null
          event?: string | null
          fn: string
          id?: string
          level?: string | null
          message?: string | null
          method?: string | null
          order_id?: string | null
          payload?: Json | null
          status?: number | null
          url?: string | null
        }
        Update: {
          call_sid?: string | null
          created_at?: string
          direction?: string
          duration_ms?: number | null
          error?: string | null
          event?: string | null
          fn?: string
          id?: string
          level?: string | null
          message?: string | null
          method?: string | null
          order_id?: string | null
          payload?: Json | null
          status?: number | null
          url?: string | null
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          display_name: string
          is_active: boolean
        }
        Insert: {
          code: string
          display_name: string
          is_active?: boolean
        }
        Update: {
          code?: string
          display_name?: string
          is_active?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      recipient_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          recipient_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          recipient_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipient_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipient_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      recipients: {
        Row: {
          address: string | null
          company_name: string | null
          contact_no: string | null
          contact_no_e164: string | null
          courier_name: string | null
          created_at: string
          customer_name: string | null
          dedupe_key: string | null
          dispatch_quantity: number | null
          email: string | null
          id: string
          import_batch_id: string | null
          language_source: Database["public"]["Enums"]["language_source"] | null
          missing_address: boolean
          missing_product: boolean
          order_date: string | null
          order_id: string | null
          ordered_quantity: number | null
          preferred_language: string | null
          product_delivery_date: string | null
          product_name: string | null
          status: Database["public"]["Enums"]["recipient_status"]
          telecaller_name: string | null
          telecaller_phone: string | null
          unique_id: string
          updated_at: string
          vendor_dispatch_id: string | null
          vendor_po_number: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          contact_no?: string | null
          contact_no_e164?: string | null
          courier_name?: string | null
          created_at?: string
          customer_name?: string | null
          dedupe_key?: string | null
          dispatch_quantity?: number | null
          email?: string | null
          id?: string
          import_batch_id?: string | null
          language_source?:
            | Database["public"]["Enums"]["language_source"]
            | null
          missing_address?: boolean
          missing_product?: boolean
          order_date?: string | null
          order_id?: string | null
          ordered_quantity?: number | null
          preferred_language?: string | null
          product_delivery_date?: string | null
          product_name?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          telecaller_name?: string | null
          telecaller_phone?: string | null
          unique_id?: string
          updated_at?: string
          vendor_dispatch_id?: string | null
          vendor_po_number?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          contact_no?: string | null
          contact_no_e164?: string | null
          courier_name?: string | null
          created_at?: string
          customer_name?: string | null
          dedupe_key?: string | null
          dispatch_quantity?: number | null
          email?: string | null
          id?: string
          import_batch_id?: string | null
          language_source?:
            | Database["public"]["Enums"]["language_source"]
            | null
          missing_address?: boolean
          missing_product?: boolean
          order_date?: string | null
          order_id?: string | null
          ordered_quantity?: number | null
          preferred_language?: string | null
          product_delivery_date?: string | null
          product_name?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          telecaller_name?: string | null
          telecaller_phone?: string | null
          unique_id?: string
          updated_at?: string
          vendor_dispatch_id?: string | null
          vendor_po_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipients_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipients_preferred_language_fkey"
            columns: ["preferred_language"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      voc_recordings: {
        Row: {
          call_attempt_id: string
          call_type: Database["public"]["Enums"]["call_type"]
          caller_type: Database["public"]["Enums"]["caller_type"]
          created_at: string
          dtmf_outcome: string | null
          duration_seconds: number | null
          id: string
          language: string | null
          product_name: string | null
          recipient_id: string
          sealed_voc_id: string
          storage_path: string
        }
        Insert: {
          call_attempt_id: string
          call_type: Database["public"]["Enums"]["call_type"]
          caller_type: Database["public"]["Enums"]["caller_type"]
          created_at?: string
          dtmf_outcome?: string | null
          duration_seconds?: number | null
          id?: string
          language?: string | null
          product_name?: string | null
          recipient_id: string
          sealed_voc_id: string
          storage_path: string
        }
        Update: {
          call_attempt_id?: string
          call_type?: Database["public"]["Enums"]["call_type"]
          caller_type?: Database["public"]["Enums"]["caller_type"]
          created_at?: string
          dtmf_outcome?: string | null
          duration_seconds?: number | null
          id?: string
          language?: string | null
          product_name?: string | null
          recipient_id?: string
          sealed_voc_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "voc_recordings_call_attempt_id_fkey"
            columns: ["call_attempt_id"]
            isOneToOne: false
            referencedRelation: "call_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voc_recordings_language_fkey"
            columns: ["language"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "voc_recordings_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      call_outcome:
        | "confirmed"
        | "corrected"
        | "no_answer"
        | "wrong_number"
        | "issue_raised"
        | "transferred_to_agent"
        | "not_reachable"
      call_type: "order_confirmation" | "delivery_confirmation"
      caller_type: "ivr" | "agent"
      language_source:
        | "recipient_selected"
        | "defaulted"
        | "region_inferred"
        | "agent_set"
      recipient_status:
        | "imported"
        | "order_confirm_pending"
        | "address_confirmed"
        | "address_corrected"
        | "order_unreachable"
        | "dispatched"
        | "delivered"
        | "delivery_confirm_pending"
        | "confirmed"
        | "issue_raised"
        | "delivery_unreachable"
        | "closed"
      user_role: "admin" | "telecaller"
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
      call_outcome: [
        "confirmed",
        "corrected",
        "no_answer",
        "wrong_number",
        "issue_raised",
        "transferred_to_agent",
        "not_reachable",
      ],
      call_type: ["order_confirmation", "delivery_confirmation"],
      caller_type: ["ivr", "agent"],
      language_source: [
        "recipient_selected",
        "defaulted",
        "region_inferred",
        "agent_set",
      ],
      recipient_status: [
        "imported",
        "order_confirm_pending",
        "address_confirmed",
        "address_corrected",
        "order_unreachable",
        "dispatched",
        "delivered",
        "delivery_confirm_pending",
        "confirmed",
        "issue_raised",
        "delivery_unreachable",
        "closed",
      ],
      user_role: ["admin", "telecaller"],
    },
  },
} as const

// ── Convenience aliases (not generated by supabase gen types) ──────────────

export type Recipient = Tables<'recipients'>
export type Profile = Tables<'profiles'>
export type Language = Tables<'languages'>

export type RecipientStatus = Database['public']['Enums']['recipient_status']
export type CallOutcome = Database['public']['Enums']['call_outcome']
export type CallType = Database['public']['Enums']['call_type']
export type CallerType = Database['public']['Enums']['caller_type']
export type LanguageSource = Database['public']['Enums']['language_source']
export type UserRole = Database['public']['Enums']['user_role']

export interface LanguageConfigEntry {
  dtmf: string
  lang: string
}

export type Update<T> = { [K in keyof T]?: T[K] }
