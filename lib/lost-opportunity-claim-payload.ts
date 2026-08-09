interface ClaimedClientPayload {
  id?: unknown;
  status?: unknown;
  customer_type?: unknown;
  contact_person?: unknown;
  contact_position?: unknown;
  contact_number?: unknown;
  office_address?: unknown;
  sales_channel?: unknown;
  details_completed_at?: unknown;
  minor_notes?: unknown;
  office_lat?: unknown;
  office_lng?: unknown;
  company_name?: unknown;
  city?: unknown;
}
const CLAIM_CODES = ['claimed', 'role_not_eligible', 'former_owner_excluded', 'cooling_down', 'not_found_or_not_lost', 'already_claimed'] as const;
export type DecodedClaimRpcResult = { code: (typeof CLAIM_CODES)[number]; client: unknown };

function isBlank(value: unknown): boolean {
  return value == null || value === '';
}

/** Accept only a redacted prospect, never the legacy history-bearing row. */
export function parseFreshProspectId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const client = value as ClaimedClientPayload;
  const allowed = new Set(['id', 'company_name', 'city', 'status', 'customer_type']);
  if (Object.keys(client as Record<string, unknown>).some((key) => !allowed.has(key))) return null;
  if (typeof client.id !== 'string' || client.id.length === 0) return null;
  if (typeof client.company_name !== 'string' || typeof client.city !== 'string') return null;
  if (client.status !== 'active' || client.customer_type !== 'prospect') return null;
  if (!isBlank(client.contact_person) || !isBlank(client.contact_position) ||
      !isBlank(client.contact_number) || !isBlank(client.office_address) ||
      !isBlank(client.sales_channel) || !isBlank(client.details_completed_at) ||
      !isBlank(client.minor_notes) || !isBlank(client.office_lat) || !isBlank(client.office_lng)) {
    return null;
  }
  return client.id;
}

export function decodeClaimRpcResult(value: unknown): DecodedClaimRpcResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Hindi ma-verify ang claim response mula sa server.');
  const result = value as Record<string, unknown>;
  if (typeof result.code !== 'string' || !CLAIM_CODES.includes(result.code as (typeof CLAIM_CODES)[number])) throw new Error('Hindi ma-verify ang claim response mula sa server.');
  return { code: result.code as (typeof CLAIM_CODES)[number], client: result.client };
}
