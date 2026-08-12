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
  address_line1?: unknown;
  address_line2?: unknown;
  landmark?: unknown;
  province?: unknown;
  office_pin_source?: unknown;
  office_pin_updated_at?: unknown;
}
const CLAIM_CODES = ['claimed', 'role_not_eligible', 'former_owner_excluded', 'cooling_down', 'not_found_or_not_lost', 'already_claimed'] as const;
const SAFE_PROFILE_KEYS = new Set([
  'id', 'company_name', 'city', 'status', 'customer_type', 'contact_person',
  'contact_position', 'contact_number', 'office_address', 'address_line1',
  'address_line2', 'landmark', 'province', 'office_lat', 'office_lng',
  'office_pin_source', 'office_pin_updated_at', 'sales_channel',
]);
export type DecodedClaimRpcResult = { code: (typeof CLAIM_CODES)[number]; client: unknown };

function optionalString(value: unknown): boolean {
  return value == null || typeof value === 'string';
}

function optionalNumber(value: unknown): boolean {
  return value == null || (typeof value === 'number' && Number.isFinite(value));
}

/** Accept only a redacted prospect, never the legacy history-bearing row. */
export function parseFreshProspectId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const client = value as ClaimedClientPayload;
  if (Object.keys(client as Record<string, unknown>).some((key) => !SAFE_PROFILE_KEYS.has(key))) return null;
  if (typeof client.id !== 'string' || client.id.length === 0) return null;
  if (typeof client.company_name !== 'string' || typeof client.city !== 'string') return null;
  if (client.status !== 'active' || client.customer_type !== 'prospect') return null;
  if (!optionalString(client.contact_person) || !optionalString(client.contact_position) ||
      !optionalString(client.contact_number) || !optionalString(client.office_address) ||
      !optionalString(client.sales_channel) || !optionalString(client.address_line1) ||
      !optionalString(client.address_line2) || !optionalString(client.landmark) ||
      !optionalString(client.province) || !optionalString(client.office_pin_source) ||
      !optionalString(client.office_pin_updated_at) || !optionalNumber(client.office_lat) ||
      !optionalNumber(client.office_lng)) return null;
  return client.id;
}

export function decodeClaimRpcResult(value: unknown): DecodedClaimRpcResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error("Can't verify the claim response from the server.");
  const result = value as Record<string, unknown>;
  if (typeof result.code !== 'string' || !CLAIM_CODES.includes(result.code as (typeof CLAIM_CODES)[number])) throw new Error("Can't verify the claim response from the server.");
  return { code: result.code as (typeof CLAIM_CODES)[number], client: result.client };
}
