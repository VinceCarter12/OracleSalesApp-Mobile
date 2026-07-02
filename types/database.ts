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
          customer_type: string;
          sales_channel: string;
          agent_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
      };
      meetings: {
        Row: {
          id: string;
          client_id: string | null;
          agent_id: string;
          gps_lat: number;
          gps_lng: number;
          selfie_url: string;
          agendas: string[];
          outcome: string;
          logged_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['meetings']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['meetings']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: string;
          team_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
