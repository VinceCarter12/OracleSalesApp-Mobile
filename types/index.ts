// ─── Domain constants ──────────────────────────────────────────────────────────

export const CUSTOMER_TYPES = [
  'Dealer',
  'Sub-Dealer',
  'Direct Account',
  'Government',
  'End-User',
] as const;

export const SALES_CHANNELS = [
  'Direct Sales',
  'Dealer Network',
  'Online',
  'Referral',
  'Other',
] as const;

export const MEETING_AGENDAS = [
  'Product Presentation',
  'Pricing Negotiation',
  'Follow-up',
  'Contract Signing',
  'After-Sales Support',
  'New Requirements',
  'Other',
] as const;

export const MEETING_OUTCOMES = [
  'Successful',
  'Follow-up Required',
  'No Decision',
  'Lost Opportunity',
] as const;

// ─── TypeScript types ──────────────────────────────────────────────────────────

export type CustomerType = typeof CUSTOMER_TYPES[number];
export type SalesChannel = typeof SALES_CHANNELS[number];
export type MeetingOutcome = typeof MEETING_OUTCOMES[number];

export interface Client {
  id: string;
  company_name: string;
  contact_person: string;
  customer_type: CustomerType;
  sales_channel: SalesChannel;
  agent_id: string;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  client_id: string | null;
  client_name?: string | null;
  agent_id: string;
  gps_lat: number;
  gps_lng: number;
  selfie_url: string;
  agendas: string[];
  outcome: MeetingOutcome;
  logged_at: string;
  created_at: string;
}

export type UserRole = 'sales_specialist' | 'sales_manager' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  team_id: string | null;
}
