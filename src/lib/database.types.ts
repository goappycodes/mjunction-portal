// Hand-maintained to match supabase/migrations. Keep in sync with the SQL.

export type UserRole = 'admin' | 'telecaller';

export type RecipientStatus =
  | 'imported'
  | 'order_confirm_pending'
  | 'address_confirmed'
  | 'address_corrected'
  | 'order_unreachable'
  | 'dispatched'
  | 'delivered'
  | 'delivery_confirm_pending'
  | 'confirmed'
  | 'issue_raised'
  | 'delivery_unreachable'
  | 'closed';

export type CallType = 'order_confirmation' | 'delivery_confirmation';
export type CallerType = 'ivr' | 'agent';
export type CallOutcome =
  | 'confirmed'
  | 'corrected'
  | 'no_answer'
  | 'wrong_number'
  | 'issue_raised'
  | 'transferred_to_agent'
  | 'not_reachable';
export type LanguageSource =
  | 'recipient_selected'
  | 'defaulted'
  | 'region_inferred'
  | 'agent_set';

export type LanguageConfigEntry = { dtmf: string; lang: string };

type Timestamps = { created_at: string };

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export type Language = {
  code: string;
  display_name: string;
  is_active: boolean;
}

export type Campaign = {
  id: string;
  calling_from: string;
  order_reference: string | null;
  start_date: string | null;
  end_date: string | null;
  default_language: string;
  retry_limit: number;
  skip_menu_if_known: boolean;
  language_config: LanguageConfigEntry[];
  created_by: string | null;
  created_at: string;
}

export type Recipient = {
  id: string;
  campaign_id: string;
  unique_id: string;
  calling_from: string | null;
  telecaller_name: string | null;
  contact_no: string | null;
  contact_no_e164: string | null;
  customer_name: string | null;
  address: string | null;
  product_name: string | null;
  product_delivery_date: string | null;
  status: RecipientStatus;
  preferred_language: string | null;
  language_source: LanguageSource | null;
  missing_address: boolean;
  missing_product: boolean;
  dedupe_key: string | null;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ImportBatch = {
  id: string;
  campaign_id: string | null;
  file_name: string | null;
  row_count: number | null;
  valid_count: number | null;
  error_count: number | null;
  duplicate_count: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export type CallAttempt = {
  id: string;
  recipient_id: string;
  campaign_id: string;
  call_type: CallType;
  attempt_number: number;
  provider: string;
  caller_type: CallerType;
  agent_id: string | null;
  language: string | null;
  language_defaulted: boolean;
  dtmf_response: string | null;
  outcome: CallOutcome | null;
  agent_note: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export type Dispatch = {
  id: string;
  recipient_id: string;
  courier_name: string | null;
  awb_number: string | null;
  dispatch_date: string | null;
  delivered_date: string | null;
  created_by: string | null;
  created_at: string;
}

export type VocRecording = {
  id: string;
  sealed_voc_id: string;
  recipient_id: string;
  campaign_id: string;
  call_attempt_id: string;
  call_type: CallType;
  product_name: string | null;
  caller_type: CallerType;
  language: string | null;
  dtmf_outcome: string | null;
  storage_path: string;
  duration_seconds: number | null;
  created_at: string;
}

export type RecipientEvent = {
  id: string;
  recipient_id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

type Insert<T, Optional extends keyof T = never> = Omit<T, Optional> &
  Partial<Pick<T, Optional>>;
type Update<T> = Partial<T>;

// Fields with DB defaults are optional on insert.
type DefaultCols = 'id' | keyof Timestamps;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Insert<Profile, 'created_at' | 'full_name' | 'role'>;
        Update: Update<Profile>;
        Relationships: [];
      };
      languages: {
        Row: Language;
        Insert: Insert<Language, 'is_active'>;
        Update: Update<Language>;
        Relationships: [];
      };
      campaigns: {
        Row: Campaign;
        Insert: Insert<
          Campaign,
          | DefaultCols
          | 'order_reference'
          | 'start_date'
          | 'end_date'
          | 'default_language'
          | 'retry_limit'
          | 'skip_menu_if_known'
          | 'language_config'
          | 'created_by'
        >;
        Update: Update<Campaign>;
        Relationships: [
          {
            foreignKeyName: 'campaigns_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      recipients: {
        Row: Recipient;
        Insert: Insert<
          Recipient,
          | DefaultCols
          | 'unique_id'
          | 'updated_at'
          | 'status'
          | 'missing_address'
          | 'missing_product'
          | 'calling_from'
          | 'telecaller_name'
          | 'contact_no'
          | 'contact_no_e164'
          | 'customer_name'
          | 'address'
          | 'product_name'
          | 'product_delivery_date'
          | 'preferred_language'
          | 'language_source'
          | 'dedupe_key'
          | 'import_batch_id'
        >;
        Update: Update<Recipient>;
        Relationships: [
          {
            foreignKeyName: 'recipients_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipients_import_batch_id_fkey';
            columns: ['import_batch_id'];
            isOneToOne: false;
            referencedRelation: 'import_batches';
            referencedColumns: ['id'];
          },
        ];
      };
      import_batches: {
        Row: ImportBatch;
        Insert: Insert<ImportBatch, DefaultCols>;
        Update: Update<ImportBatch>;
        Relationships: [
          {
            foreignKeyName: 'import_batches_campaign_fk';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      call_attempts: {
        Row: CallAttempt;
        Insert: Insert<
          CallAttempt,
          | DefaultCols
          | 'attempt_number'
          | 'provider'
          | 'caller_type'
          | 'language_defaulted'
          | 'agent_id'
          | 'language'
          | 'dtmf_response'
          | 'outcome'
          | 'agent_note'
          | 'started_at'
          | 'ended_at'
        >;
        Update: Update<CallAttempt>;
        Relationships: [
          {
            foreignKeyName: 'call_attempts_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'recipients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_attempts_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      dispatches: {
        Row: Dispatch;
        Insert: Insert<
          Dispatch,
          | DefaultCols
          | 'courier_name'
          | 'awb_number'
          | 'dispatch_date'
          | 'delivered_date'
          | 'created_by'
        >;
        Update: Update<Dispatch>;
        Relationships: [
          {
            foreignKeyName: 'dispatches_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: true;
            referencedRelation: 'recipients';
            referencedColumns: ['id'];
          },
        ];
      };
      voc_recordings: {
        Row: VocRecording;
        Insert: Insert<VocRecording, DefaultCols | 'duration_seconds'>;
        Update: Update<VocRecording>;
        Relationships: [
          {
            foreignKeyName: 'voc_recordings_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'recipients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'voc_recordings_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      recipient_events: {
        Row: RecipientEvent;
        Insert: Insert<RecipientEvent, DefaultCols | 'payload' | 'actor_id'>;
        Update: Update<RecipientEvent>;
        Relationships: [
          {
            foreignKeyName: 'recipient_events_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'recipients';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      recipient_status: RecipientStatus;
      call_type: CallType;
      caller_type: CallerType;
      call_outcome: CallOutcome;
      language_source: LanguageSource;
    };
    CompositeTypes: Record<string, never>;
  };
}
