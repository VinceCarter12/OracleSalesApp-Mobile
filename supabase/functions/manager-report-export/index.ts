import { createClient } from 'supabase';
import * as XLSX from 'xlsx';

type ReportTimeframe = 'This month' | 'Last 30 days' | 'This quarter' | 'Custom';
type ExportCategory = 'meetings' | 'successful' | 'new_clients' | 'lost';

interface ExportRequest {
  timeframe: ReportTimeframe;
  agentIds: string[];
  categories: ExportCategory[];
  searchQuery: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
  team_id: string | null;
}

interface ClientRow {
  id: string;
  company_name: string;
  customer_type: string | null;
  status: string;
  assigned_agent_id: string;
  created_at: string;
}

interface MeetingRow {
  id: string;
  client_id: string | null;
  agent_id: string;
  meeting_type: string | null;
  outcome: string | null;
  meeting_date: string;
  start_captured_at: string | null;
  end_captured_at: string | null;
  client_status_at_meeting: string | null;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};
const CATEGORIES: ExportCategory[] = ['meetings', 'successful', 'new_clients', 'lost'];
const TIMEFRAMES: ReportTimeframe[] = ['This month', 'Last 30 days', 'This quarter', 'Custom'];
const MAX_RECORDS = 10_000;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function manilaParts(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(fields.year), month: Number(fields.month) };
}

function timeframeStart(timeframe: ReportTimeframe, now = new Date()): string | null {
  const { year, month } = manilaParts(now);
  switch (timeframe) {
    case 'This month': return `${year}-${String(month).padStart(2, '0')}-01T00:00:00+08:00`;
    case 'Last 30 days': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'This quarter': {
      const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
      return `${year}-${String(startMonth).padStart(2, '0')}-01T00:00:00+08:00`;
    }
    case 'Custom': return null;
  }
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase();
}

function safeRequest(value: unknown): ExportRequest | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ExportRequest>;
  if (!TIMEFRAMES.includes(candidate.timeframe as ReportTimeframe) || !Array.isArray(candidate.agentIds) || !Array.isArray(candidate.categories) || typeof candidate.searchQuery !== 'string') return null;
  if (candidate.agentIds.some((id) => typeof id !== 'string') || candidate.categories.some((category) => !CATEGORIES.includes(category as ExportCategory))) return null;
  if (candidate.agentIds.length > 100 || candidate.categories.length === 0 || candidate.searchQuery.length > 100) return null;
  return {
    timeframe: candidate.timeframe as ReportTimeframe,
    agentIds: [...new Set(candidate.agentIds)],
    categories: [...new Set(candidate.categories as ExportCategory[])],
    searchQuery: candidate.searchQuery.trim(),
  };
}

function displayDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function durationMinutes(meeting: MeetingRow): number | null {
  if (!meeting.start_captured_at || !meeting.end_captured_at) return null;
  const minutes = Math.round((new Date(meeting.end_captured_at).getTime() - new Date(meeting.start_captured_at).getTime()) / 60_000);
  return minutes >= 0 ? minutes : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const payload = safeRequest(await request.json().catch(() => null));
  if (!payload) return json({ error: 'Invalid export filters.' }, 400);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Kailangan munang mag-sign in bago mag-export.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Export service is not configured.' }, 500);

  // Validate the caller with their JWT first. The service client below is
  // necessary for full team export, so no request-supplied team or profile id
  // is ever trusted as an authorization boundary.
  const callerClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Hindi na-verify ang sign-in session.' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerProfile, error: callerError } = await admin
    .from('profiles')
    .select('id, full_name, role, team_id')
    .eq('user_id', userData.user.id)
    .single<ProfileRow>();
  if (callerError || !callerProfile || callerProfile.role !== 'sales_manager' || !callerProfile.team_id) {
    return json({ error: 'Manager team reports lang ang puwedeng i-export dito.' }, 403);
  }

  const { data: roster, error: rosterError } = await admin
    .from('profiles')
    .select('id, full_name, role, team_id')
    .eq('team_id', callerProfile.team_id)
    .in('role', ['sales_specialist', 'rsr']);
  if (rosterError) return json({ error: 'Hindi ma-load ang team roster.' }, 500);

  const allowedProfiles = [callerProfile, ...((roster ?? []) as ProfileRow[])];
  const allowedIds = new Set(allowedProfiles.map((profile) => profile.id));
  const selectedAgentIds = payload.agentIds.length === 0
    ? [...allowedIds]
    : payload.agentIds.filter((id) => allowedIds.has(id));
  if (selectedAgentIds.length === 0) return json({ error: 'Walang selected user sa iyong team.' }, 403);

  const start = timeframeStart(payload.timeframe);
  let meetingsQuery = admin
    .from('meetings')
    .select('id, client_id, agent_id, meeting_type, outcome, meeting_date, start_captured_at, end_captured_at, client_status_at_meeting')
    .in('agent_id', selectedAgentIds)
    .order('meeting_date', { ascending: false })
    .range(0, MAX_RECORDS);
  let clientsQuery = admin
    .from('clients')
    .select('id, company_name, customer_type, status, assigned_agent_id, created_at')
    .in('assigned_agent_id', selectedAgentIds)
    .not('status', 'in', '(lost,deleted)')
    .order('created_at', { ascending: false })
    .range(0, MAX_RECORDS);
  if (start) {
    meetingsQuery = meetingsQuery.gte('meeting_date', start);
    clientsQuery = clientsQuery.gte('created_at', start);
  }
  const [{ data: meetingRows, error: meetingError }, { data: clientRows, error: clientError }] = await Promise.all([meetingsQuery, clientsQuery]);
  if (meetingError || clientError) return json({ error: 'Hindi ma-load ang report records.' }, 500);
  if ((meetingRows?.length ?? 0) > MAX_RECORDS || (clientRows?.length ?? 0) > MAX_RECORDS) return json({ error: 'Masyadong marami ang records. Pumili ng mas maikling timeframe o user.' }, 413);

  const profileNameById = new Map(allowedProfiles.map((profile) => [profile.id, profile.full_name]));
  const clients = (clientRows ?? []) as ClientRow[];
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const query = normalize(payload.searchQuery);
  const meetings = ((meetingRows ?? []) as MeetingRow[]).filter((meeting) => !query || [
    profileNameById.get(meeting.agent_id), clientById.get(meeting.client_id ?? '')?.company_name, meeting.meeting_type, meeting.outcome,
  ].some((value) => normalize(value).includes(query)));
  const newClients = clients.filter((client) => (client.customer_type === 'new' || client.customer_type === 'existing') && (!query || [
    profileNameById.get(client.assigned_agent_id), client.company_name, client.customer_type,
  ].some((value) => normalize(value).includes(query))));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Oracle Sales App Team Report'],
    ['Generated (Asia/Manila)', new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })],
    ['Timeframe', payload.timeframe === 'Custom' ? 'All time' : payload.timeframe],
    ['Users', payload.agentIds.length === 0 ? 'Whole team' : selectedAgentIds.map((id) => profileNameById.get(id) ?? id).join(', ')],
    ['Categories', payload.categories.join(', ')],
    ['Search', payload.searchQuery || 'None'],
    [],
    ['Metric', 'Count'],
    ['Total meetings', meetings.length],
    ['Successful meetings', meetings.filter((meeting) => meeting.outcome === 'successful').length],
    ['New clients acquired', newClients.length],
    ['Lost opportunities', meetings.filter((meeting) => meeting.outcome === 'lost_opportunity').length],
  ]), 'Summary');

  const meetingSheet = (title: string, rows: MeetingRow[]) => XLSX.utils.json_to_sheet(rows.map((meeting) => ({
    Date: displayDate(meeting.meeting_date),
    Agent: profileNameById.get(meeting.agent_id) ?? 'Unknown',
    Client: clientById.get(meeting.client_id ?? '')?.company_name ?? 'Unknown client',
    'Meeting mode': meeting.meeting_type === 'online' ? 'Online' : 'On-site',
    Outcome: meeting.outcome ?? 'Not recorded',
    'Client status at meeting': meeting.client_status_at_meeting ?? 'Not recorded',
    'Duration (minutes)': durationMinutes(meeting) ?? '',
  })));
  if (payload.categories.includes('meetings')) XLSX.utils.book_append_sheet(workbook, meetingSheet('Meetings', meetings), 'Meetings');
  if (payload.categories.includes('successful')) XLSX.utils.book_append_sheet(workbook, meetingSheet('Successful', meetings.filter((meeting) => meeting.outcome === 'successful')), 'Successful');
  if (payload.categories.includes('lost')) XLSX.utils.book_append_sheet(workbook, meetingSheet('Lost opportunities', meetings.filter((meeting) => meeting.outcome === 'lost_opportunity')), 'Lost opportunities');
  if (payload.categories.includes('new_clients')) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(newClients.map((client) => ({
    'Acquired date': displayDate(client.created_at),
    Agent: profileNameById.get(client.assigned_agent_id) ?? 'Unknown',
    Client: client.company_name,
    Stage: client.customer_type === 'new' ? 'New' : 'Existing',
  }))), 'New clients');

  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Response(output, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="team-report.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
});
