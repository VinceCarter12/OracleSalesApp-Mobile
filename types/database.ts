import type {
  ClientStatus,
  CustomerType,
  MeetingMode,
  MeetingOutcome,
  SalesChannel,
} from './index';

/**
 * Supabase database type stubs.
 * Replace with the generated types from: npx supabase gen types typescript --project-id <your-id>
 */
export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          company_name: string;
          contact_person: string;
          position: string | null;
          contact_number: string | null;
          office_address: string | null;
          customer_type: CustomerType;
          sales_channel: SalesChannel;
          status: ClientStatus | null;
          agent_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          client_id: string | null;
          agent_id: string;
          gps_lat: number;
          gps_lng: number;
          selfie_url: string | null;
          agendas: string[];
          outcome: MeetingOutcome | null;
          meeting_mode: MeetingMode | null;
          start_photo_url: string | null;
          start_captured_at: string | null;
          end_photo_url: string | null;
          end_captured_at: string | null;
          logged_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['meetings']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['meetings']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          full_name: string;
          role: string;
          team_id: string | null;
          is_active: boolean;
          created_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
