# Web App Status — `Cedie99/OracleSalesApp-Web`

> **Last synced:** Jul 4, 2026, 8:50 PM
> Run `npm run web:status` to refresh.
> Shared Supabase project — changes here may affect the mobile app.

---

## Recent Commits on `main` (last 10)

- `699d70b` **improved scripting technique** — Cedie99 · Jul 4, 2026, 8:48 PM
- `17869a7` **added script for auto updating changes from mobile app version** — Cedie99 · Jul 4, 2026, 8:23 PM
- `e814b40` **Revised documentation** — Cedie99 · Jun 30, 2026, 7:27 AM
- `68765ea` **Comprehensive project documentation with git workflow tutorial** — Cedie99 · Jun 30, 2026, 7:23 AM
- `14b7c35` **Sales App Web first project draft** — Cedie99 · Jun 30, 2026, 7:15 AM
- `52777c9` **first commit** — Cedie99 · Jun 30, 2026, 7:13 AM

---

## Recently Merged PRs → `main`

_No recently merged PRs found._

---

## Root-Level Files

### `package.json`

```json
{
  "name": "sales-admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "mobile:status": "node scripts/sync-mobile-status.mjs"
  },
  "dependencies": {
    "@base-ui/react": "^1.6.0",
    "@supabase/ssr": "^0.12.0",
    "@supabase/supabase-js": "^2.108.2",
    "@tanstack/react-table": "^8.21.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.4.0",
    "lucide-react": "^1.21.0",
    "next": "16.2.9",
    "next-themes": "^0.4.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.9.0",
    "shadcn": "^4.11.1",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### `.env.local.example`

_File not found in the web repo._

---

## `app/`

### `app/(admin)/approvals/page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { mockEditRequests } from '@/lib/mock/data'
import type { ApprovalStatus } from '@/types'
import { ClipboardCheck, Check, X, Clock, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  approved: 'bg-primary/15 text-primary border-primary/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
}

const FIELD_LABEL: Record<string, string> = {
  sales_channel: 'Sales Channel',
  customer_type: 'Customer Type',
  contact_person: 'Contact Person',
  contact_number: 'Contact Number',
  office_address: 'Office Address',
  contact_position: 'Contact Position',
}

const VALUE_LABEL: Record<string, string> = {
  distributor: 'Distributor', dealer: 'Dealer', end_user: 'End-User', private_label: 'Private Label',
  existing: 'Existing', new: 'New', prospect: 'Prospect',
}

export default function ApprovalsPage() {
  const [requests, setRequests] = useState(mockEditRequests)

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')

  function handleReview(id: string, action: 'approved' | 'rejected') {
    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status: action, reviewed_at: new Date().toISOString() } : r
    ))
    toast.success(`Request ${action === 'approved' ? 'approved' : 'rejected'} successfully`)
  }

  function RequestCard({ req }: { req: typeof mockEditRequests[0] }) {
    return (
      <Card key={req.id} className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-foreground text-sm">{req.client?.company_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Requested by <span className="text-foreground">{req.requester?.full_name}</span> · {format(new Date(req.created_at), 'MMM d, h:mm a')}
              </p>
            </div>
            <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${STATUS_STYLE[req.status]}`}>
              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
            </Badge>
          </div>

          {/* Changes */}
          <div className="space-y-2 mb-3">
            {Object.entries(req.changes).map(([field, change]) => (
              <div key={field} className="bg-muted/30 rounded-lg px-3 py-2 text-xs">
                <p className="text-muted-foreground mb-1.5 font-medium">{FIELD_LABEL[field] ?? field}</p>
                <div className="flex items-center gap-2">
                  <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded line-through">
                    {VALUE_LABEL[change.old as string] ?? String(change.old)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                    {VALUE_LABEL[change.new as string] ?? String(change.new)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {req.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleReview(req.id, 'approved')}
                className="flex-1 h-8 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-xs"
                variant="outline"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                onClick={() => handleReview(req.id, 'rejected')}
                className="flex-1 h-8 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 text-xs"
                variant="outline"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            </div>
          )}

          {req.status !== 'pending' && req.reviewer && (
            <p className="text-xs text-muted-foreground">
              Reviewed by {req.reviewer.full_name} · {req.reviewed_at ? format(new Date(req.reviewed_at), 'MMM d, h:mm a') : '—'}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Edit Approvals" subtitle="Client detail change requests" pendingApprovals={pending.length} />

      <div className="flex-1 p-6">
        <Tabs defaultValue="pending">
          <TabsList className="bg-card border border-border mb-5">
            <TabsTrigger value="pending" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Resolved ({resolved.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pending.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No pending approvals</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pending.map(req => <RequestCard key={req.id} req={req} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolved">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {resolved.map(req => <RequestCard key={req.id} req={req} />)}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

### `app/(admin)/clients/page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { mockClients } from '@/lib/mock/data'
import type { CustomerType, SalesChannel, ClientStatus } from '@/types'
import { Search, Building2, Phone, MapPin, User } from 'lucide-react'
import { format } from 'date-fns'

const CUSTOMER_TYPE_STYLE: Record<CustomerType, string> = {
  existing: 'bg-primary/15 text-primary border-primary/30',
  new: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  prospect: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
}

const CHANNEL_STYLE: Record<SalesChannel, string> = {
  distributor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  dealer: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  end_user: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  private_label: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
}

const STATUS_STYLE: Record<ClientStatus, string> = {
  active: 'bg-primary/15 text-primary border-primary/30',
  lost: 'bg-destructive/15 text-destructive border-destructive/30',
  deleted: 'bg-muted text-muted-foreground border-border',
}

const LABEL: Record<string, string> = {
  existing: 'Existing', new: 'New', prospect: 'Prospect',
  distributor: 'Distributor', dealer: 'Dealer', end_user: 'End-User', private_label: 'Private Label',
  active: 'Active', lost: 'Lost', deleted: 'Deleted',
}

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = mockClients.filter(c => {
    const matchSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_person.toLowerCase().includes(search.toLowerCase()) ||
      (c.agent?.full_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || c.customer_type === typeFilter
    const matchChannel = channelFilter === 'all' || c.sales_channel === channelFilter
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchType && matchChannel && matchStatus
  })

  return (
    <div className="flex flex-col flex-1">
      <Header title="Clients" subtitle={`${filtered.length} of ${mockClients.length} clients`} />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search company, contact, or agent..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border h-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v ?? 'all')}>
            <SelectTrigger className="w-36 h-9 bg-card border-border">
              <SelectValue placeholder="Customer Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="existing">Existing</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={v => setChannelFilter(v ?? 'all')}>
            <SelectTrigger className="w-36 h-9 bg-card border-border">
              <SelectValue placeholder="Sales Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="distributor">Distributor</SelectItem>
              <SelectItem value="dealer">Dealer</SelectItem>
              <SelectItem value="end_user">End-User</SelectItem>
              <SelectItem value="private_label">Private Label</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
            <SelectTrigger className="w-32 h-9 bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Client cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => (
            <Card key={client.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-tight">{client.company_name}</p>
                      <Badge variant="outline" className={`text-[10px] px-1.5 h-4 mt-0.5 ${STATUS_STYLE[client.status]}`}>
                        {LABEL[client.status]}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{client.contact_person}{client.contact_position ? ` · ${client.contact_position}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{client.contact_number}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{client.office_address}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${CUSTOMER_TYPE_STYLE[client.customer_type]}`}>
                    {LABEL[client.customer_type]}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${CHANNEL_STYLE[client.sales_channel]}`}>
                    {LABEL[client.sales_channel]}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-primary">
                        {client.agent?.full_name?.charAt(0)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{client.agent?.full_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(client.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No clients found</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### `app/(admin)/clock-records/page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { mockClockRecords } from '@/lib/mock/data'
import type { ClockType, ClockAction } from '@/types'
import { Search, Clock, MapPin, Camera, LogIn, LogOut, Calendar } from 'lucide-react'
import { format } from 'date-fns'

const TYPE_STYLE: Record<ClockType, string> = {
  office: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  event: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

const ACTION_STYLE: Record<ClockAction, string> = {
  in: 'bg-primary/15 text-primary border-primary/30',
  out: 'bg-muted text-muted-foreground border-border',
}

export default function ClockRecordsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')

  const filtered = mockClockRecords.filter(r => {
    const matchSearch = (r.agent?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.event_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || r.type === typeFilter
    const matchAction = actionFilter === 'all' || r.action === actionFilter
    return matchSearch && matchType && matchAction
  })

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, r) => {
    const day = format(new Date(r.timestamp), 'yyyy-MM-dd')
    if (!acc[day]) acc[day] = []
    acc[day].push(r)
    return acc
  }, {})

  return (
    <div className="flex flex-col flex-1">
      <Header title="Clock Records" subtitle={`${filtered.length} records`} />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search agent or event..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border h-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v ?? 'all')}>
            <SelectTrigger className="w-32 h-9 bg-card border-border">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="office">Office</SelectItem>
              <SelectItem value="event">Event</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={v => setActionFilter(v ?? 'all')}>
            <SelectTrigger className="w-32 h-9 bg-card border-border">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="in">Clock In</SelectItem>
              <SelectItem value="out">Clock Out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grouped by date */}
        {Object.entries(grouped)
          .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
          .map(([day, records]) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">
                  {format(new Date(day), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>

              <Card className="bg-card border-border overflow-hidden">
                <div className="divide-y divide-border">
                  {records
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .map(record => (
                      <div key={record.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${record.action === 'in' ? 'bg-primary/10' : 'bg-muted'}`}>
                          {record.action === 'in'
                            ? <LogIn className="w-4 h-4 text-primary" />
                            : <LogOut className="w-4 h-4 text-muted-foreground" />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{record.agent?.full_name}</p>
                            <Badge variant="outline" className={`text-[10px] px-1.5 h-4 ${ACTION_STYLE[record.action]}`}>
                              Clock {record.action.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] px-1.5 h-4 ${TYPE_STYLE[record.type]}`}>
                              {record.type === 'office' ? 'Office' : 'Event'}
                            </Badge>
                          </div>
                          {record.event_name && (
                            <p className="text-xs text-muted-foreground mt-0.5">{record.event_name}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                          {record.gps_lat && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-primary" />
                              <span>{record.gps_lat.toFixed(3)}, {record.gps_lng?.toFixed(3)}</span>
                            </div>
                          )}
                          {record.photo_url && <Camera className="w-3.5 h-3.5 text-primary" />}
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{format(new Date(record.timestamp), 'h:mm a')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No clock records found</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### `app/(admin)/dashboard/page.tsx`

```tsx
'use client'

import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { mockDashboardMetrics, mockMeetings, mockEditRequests } from '@/lib/mock/data'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  CalendarCheck, TrendingUp, Target, Trophy,
  Users, CheckCircle2, Clock
} from 'lucide-react'
import { format } from 'date-fns'

const OUTCOME_COLOR: Record<string, string> = {
  successful: 'bg-primary/15 text-primary border-primary/30',
  follow_up: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  no_decision: 'bg-muted text-muted-foreground border-border',
  lost_opportunity: 'bg-destructive/15 text-destructive border-destructive/30',
}

const OUTCOME_LABEL: Record<string, string> = {
  successful: 'Successful',
  follow_up: 'Follow-up',
  no_decision: 'No Decision',
  lost_opportunity: 'Lost',
}

export default function DashboardPage() {
  const m = mockDashboardMetrics
  const pending = mockEditRequests.filter(r => r.status === 'pending').length
  const recentMeetings = mockMeetings.slice(0, 5)

  const metricCards = [
    {
      title: 'Total Meetings', value: m.totalMeetings, icon: CalendarCheck,
      sub: 'This month', color: 'text-primary',
    },
    {
      title: 'Existing Clients', value: m.meetingsByType.existing, icon: Users,
      sub: `${m.successfulByType.existing} successful`, color: 'text-blue-400',
    },
    {
      title: 'New Clients', value: m.meetingsByType.new, icon: TrendingUp,
      sub: `${m.successfulByType.new} successful`, color: 'text-yellow-400',
    },
    {
      title: 'Prospects', value: m.meetingsByType.prospect, icon: Target,
      sub: `${m.successfulByType.prospect} successful`, color: 'text-purple-400',
    },
    {
      title: 'Closed Deals', value: m.closedDeals, icon: Trophy,
      sub: 'Prospect → Closed', color: 'text-primary',
    },
    {
      title: 'Pending Approvals', value: pending, icon: Clock,
      sub: 'Awaiting review', color: pending > 0 ? 'text-yellow-400' : 'text-muted-foreground',
    },
  ]

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Dashboard"
        subtitle={`Overview for ${format(new Date(), 'MMMM yyyy')}`}
        pendingApprovals={pending}
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {metricCards.map(({ title, value, icon: Icon, sub, color }) => (
            <Card key={title} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-muted-foreground leading-tight">{title}</p>
                  <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar chart */}
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Monthly Meetings Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={m.monthlyTrend} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'oklch(0.11 0 0)', border: '1px solid oklch(1 0 0 / 10%)', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: 'oklch(0.96 0 0)', fontWeight: 600 }}
                    itemStyle={{ color: 'oklch(0.75 0 0)' }}
                  />
                  <Bar dataKey="total" name="Total" fill="oklch(0.62 0.19 145 / 40%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="successful" name="Successful" fill="oklch(0.62 0.19 145)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Success Rate breakdown */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Success Rate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Existing', meetings: m.meetingsByType.existing, successful: m.successfulByType.existing },
                { label: 'New', meetings: m.meetingsByType.new, successful: m.successfulByType.new },
                { label: 'Prospect', meetings: m.meetingsByType.prospect, successful: m.successfulByType.prospect },
              ].map(({ label, meetings, successful }) => {
                const pct = meetings > 0 ? Math.round((successful / meetings) * 100) : 0
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-foreground font-medium">{successful}/{meetings} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-xs font-medium text-foreground">Meeting Outcomes</p>
                {Object.entries(OUTCOME_LABEL).map(([key, label]) => {
                  const count = mockMeetings.filter(m => m.outcome === key).length
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${OUTCOME_COLOR[key]}`}>
                        {label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent meetings */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Recent Meetings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentMeetings.map((meeting) => (
                <div key={meeting.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{meeting.client?.company_name}</p>
                    <p className="text-xs text-muted-foreground">{meeting.agent?.full_name} · {meeting.contact_person}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${OUTCOME_COLOR[meeting.outcome]}`}>
                      {OUTCOME_LABEL[meeting.outcome]}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(meeting.meeting_date), 'MMM d')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### `app/(admin)/layout.tsx`

```tsx
import { Sidebar } from '@/components/sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

### `app/(admin)/lost-opportunities/page.tsx`

```tsx
'use client'

import { Header } from '@/components/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { mockClients, mockMeetings } from '@/lib/mock/data'
import { AlertTriangle, Building2, User, Calendar, Clock, Unlock } from 'lucide-react'
import { format, formatDistanceToNow, isPast } from 'date-fns'

export default function LostOpportunitiesPage() {
  const lostClients = mockClients.filter(c => c.status === 'lost')

  return (
    <div className="flex flex-col flex-1">
      <Header title="Lost Opportunities" subtitle={`${lostClients.length} clients removed from agents`} />

      <div className="flex-1 p-6 space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-0.5">Lost Opportunity Rules</p>
            When a meeting is marked "Lost Opportunity," the client is automatically removed from the agent's list and archived here.
            After <span className="text-foreground font-medium">14 days</span>, the client becomes available for reassignment to a different agent.
            The original agent cannot re-approach.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lostClients.map(client => {
            const lostMeeting = mockMeetings.find(m => m.client_id === client.id && m.outcome === 'lost_opportunity')
            const isReassignable = client.reassignable_at ? isPast(new Date(client.reassignable_at)) : false

            return (
              <Card key={client.id} className={`bg-card border-border ${isReassignable ? 'border-primary/30' : 'border-destructive/20'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isReassignable ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                        {isReassignable
                          ? <Unlock className="w-4 h-4 text-primary" />
                          : <AlertTriangle className="w-4 h-4 text-destructive" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{client.company_name}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 h-4 mt-0.5 ${isReassignable ? 'bg-primary/15 text-primary border-primary/30' : 'bg-destructive/15 text-destructive border-destructive/30'}`}>
                          {isReassignable ? 'Ready for Reassignment' : 'Locked'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 shrink-0" />
                      <span>Lost by: <span className="text-foreground">{client.agent?.full_name}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span>{client.contact_person}</span>
                    </div>
                    {lostMeeting?.remarks && (
                      <div className="mt-2 bg-muted/30 rounded-lg p-2.5">
                        <p className="text-muted-foreground italic">"{lostMeeting.remarks}"</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-border text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Lost on</span>
                      </div>
                      <span className="text-foreground">{client.lost_at ? format(new Date(client.lost_at), 'MMM d, yyyy') : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Reassignable</span>
                      </div>
                      <span className={isReassignable ? 'text-primary font-medium' : 'text-foreground'}>
                        {client.reassignable_at
                          ? isReassignable
                            ? 'Now available'
                            : `In ${formatDistanceToNow(new Date(client.reassignable_at))}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {lostClients.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No lost opportunities</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### `app/(admin)/meetings/page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { mockMeetings } from '@/lib/mock/data'
import type { MeetingOutcome } from '@/types'
import { Search, CalendarCheck, MapPin, Camera, Video, Users, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'

const OUTCOME_STYLE: Record<MeetingOutcome, string> = {
  successful: 'bg-primary/15 text-primary border-primary/30',
  follow_up: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  no_decision: 'bg-muted text-muted-foreground border-border',
  lost_opportunity: 'bg-destructive/15 text-destructive border-destructive/30',
}

const OUTCOME_LABEL: Record<MeetingOutcome, string> = {
  successful: 'Successful',
  follow_up: 'Follow-up Required',
  no_decision: 'No Decision',
  lost_opportunity: 'Lost Opportunity',
}

const AGENDA_ICONS: Record<string, string> = {
  'New business opportunity': '💼',
  'Product/Company presentation': '📊',
  'Price negotiation/quotation': '💰',
  'Terms and Limit negotiation': '📋',
  'Negotiation (other matters)': '🤝',
  'Collection': '💳',
  'Technical support': '🔧',
  'Marketing support': '📣',
  'Complaint resolution': '⚠️',
  'Relationship building': '🫱',
  'Closed deal': '✅',
}

export default function MeetingsPage() {
  const [search, setSearch] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selected, setSelected] = useState<(typeof mockMeetings)[0] | null>(null)

  const filtered = mockMeetings.filter(m => {
    const matchSearch =
      (m.client?.company_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (m.agent?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      m.contact_person.toLowerCase().includes(search.toLowerCase())
    const matchOutcome = outcomeFilter === 'all' || m.outcome === outcomeFilter
    const matchType = typeFilter === 'all' || m.meeting_type === typeFilter
    return matchSearch && matchOutcome && matchType
  })

  return (
    <div className="flex flex-col flex-1">
      <Header title="Meetings" subtitle={`${filtered.length} records`} />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search client, agent, or contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border h-9"
            />
          </div>
          <Select value={outcomeFilter} onValueChange={v => setOutcomeFilter(v ?? 'all')}>
            <SelectTrigger className="w-40 h-9 bg-card border-border">
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              <SelectItem value="successful">Successful</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
              <SelectItem value="no_decision">No Decision</SelectItem>
              <SelectItem value="lost_opportunity">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v ?? 'all')}>
            <SelectTrigger className="w-32 h-9 bg-card border-border">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="f2f">F2F</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Outcome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate max-w-[160px]">{m.client?.company_name}</p>
                      <p className="text-xs text-muted-foreground">{m.contact_person}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{m.agent?.full_name}</p>
                      {m.recorder && (
                        <p className="text-xs text-muted-foreground">+ {m.recorder.full_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {m.meeting_type === 'f2f'
                          ? <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          : <Video className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                        <span className="text-xs text-muted-foreground">
                          {m.meeting_type === 'f2f' ? 'F2F' : m.online_platform === 'zoom' ? 'Zoom' : 'Google Meet'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {m.location_type === 'client_office' ? 'Client Office' : m.location_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(m.meeting_date), 'MMM d, yyyy')}<br/>
                      {format(new Date(m.meeting_date), 'h:mm a')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${OUTCOME_STYLE[m.outcome]}`}>
                        {OUTCOME_LABEL[m.outcome]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {m.gps_lat && <MapPin className="w-3.5 h-3.5 text-primary" />}
                        {m.photo_url && <Camera className="w-3.5 h-3.5 text-primary" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No meetings found</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Meeting Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Meeting Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{selected.client?.company_name}</p>
                  <p className="text-xs text-muted-foreground">{selected.contact_person}{selected.contact_position ? ` · ${selected.contact_position}` : ''}</p>
                </div>
                <Badge variant="outline" className={`${OUTCOME_STYLE[selected.outcome]}`}>
                  {OUTCOME_LABEL[selected.outcome]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-muted-foreground mb-1">Agent</p>
                  <p className="text-foreground font-medium">{selected.agent?.full_name}</p>
                  {selected.recorder && <p className="text-muted-foreground">Assisted by {selected.recorder.full_name}</p>}
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-muted-foreground mb-1">Date & Time</p>
                  <p className="text-foreground font-medium">{format(new Date(selected.meeting_date), 'MMM d, yyyy')}</p>
                  <p className="text-muted-foreground">{format(new Date(selected.meeting_date), 'h:mm a')}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-muted-foreground mb-1">Type</p>
                  <p className="text-foreground font-medium capitalize">
                    {selected.meeting_type === 'f2f' ? 'Face to Face' : selected.online_platform === 'zoom' ? 'Zoom' : 'Google Meet'}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-muted-foreground mb-1">Location</p>
                  <p className="text-foreground font-medium">
                    {selected.location_type === 'client_office' ? 'Client Office' : selected.location_name}
                  </p>
                  {selected.gps_lat && (
                    <p className="text-muted-foreground">{selected.gps_lat.toFixed(4)}, {selected.gps_lng?.toFixed(4)}</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Agenda</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.agenda.map(a => (
                    <Badge key={a} variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">
                      {AGENDA_ICONS[a] ?? '•'} {a}
                    </Badge>
                  ))}
                </div>
              </div>

              {selected.remarks && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Remarks</p>
                  <p className="text-sm text-foreground">{selected.remarks}</p>
                </div>
              )}

              <div className="flex gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                {selected.gps_lat && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-primary" /> GPS captured
                  </div>
                )}
                {selected.photo_url && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-primary" /> Photo taken
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

### `app/(admin)/reports/page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { mockMeetings, mockClients, mockClockRecords, mockProfiles } from '@/lib/mock/data'
import { FileBarChart2, Download, FileSpreadsheet, Users, CalendarCheck, Clock } from 'lucide-react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

const OUTCOME_LABEL: Record<string, string> = {
  successful: 'Successful', follow_up: 'Follow-up Required',
  no_decision: 'No Decision', lost_opportunity: 'Lost Opportunity',
}

const agents = mockProfiles.filter(p => p.role === 'sales_specialist' || p.role === 'sales_manager')

export default function ReportsPage() {
  const [agentFilter, setAgentFilter] = useState<string>('all')

  function downloadMeetingsReport() {
    const data = mockMeetings
      .filter(m => agentFilter === 'all' || m.agent_id === agentFilter)
      .map(m => ({
        'Date': format(new Date(m.meeting_date), 'MMM d, yyyy h:mm a'),
        'Client': m.client?.company_name ?? '',
        'Agent': m.agent?.full_name ?? '',
        'Recorded By': m.recorder?.full_name ?? m.agent?.full_name ?? '',
        'Meeting Type': m.meeting_type === 'f2f' ? 'Face to Face' : m.online_platform === 'zoom' ? 'Zoom' : 'Google Meet',
        'Location': m.location_type === 'client_office' ? 'Client Office' : m.location_name ?? '',
        'Contact Person': m.contact_person,
        'Contact Position': m.contact_position ?? '',
        'Agenda': m.agenda.join('; '),
        'Outcome': OUTCOME_LABEL[m.outcome] ?? m.outcome,
        'Remarks': m.remarks ?? '',
        'GPS': m.gps_lat ? `${m.gps_lat}, ${m.gps_lng}` : '',
      }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Meetings')
    XLSX.writeFile(wb, `meetings-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  function downloadClientsReport() {
    const data = mockClients
      .filter(c => agentFilter === 'all' || c.assigned_agent_id === agentFilter)
      .map(c => ({
        'Company Name': c.company_name,
        'Contact Person': c.contact_person,
        'Position': c.contact_position ?? '',
        'Contact Number': c.contact_number,
        'Office Address': c.office_address,
        'Customer Type': c.customer_type.charAt(0).toUpperCase() + c.customer_type.slice(1),
        'Sales Channel': c.sales_channel.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        'Assigned Agent': c.agent?.full_name ?? '',
        'Status': c.status.charAt(0).toUpperCase() + c.status.slice(1),
        'Created': format(new Date(c.created_at), 'MMM d, yyyy'),
      }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clients')
    XLSX.writeFile(wb, `clients-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  function downloadClockReport() {
    const data = mockClockRecords
      .filter(r => agentFilter === 'all' || r.agent_id === agentFilter)
      .map(r => ({
        'Agent': r.agent?.full_name ?? '',
        'Type': r.type === 'office' ? 'Office' : 'Event',
        'Action': r.action === 'in' ? 'Clock In' : 'Clock Out',
        'Event Name': r.event_name ?? '',
        'Timestamp': format(new Date(r.timestamp), 'MMM d, yyyy h:mm a'),
        'GPS': r.gps_lat ? `${r.gps_lat}, ${r.gps_lng}` : '',
        'Photo': r.photo_url ? 'Yes' : 'No',
      }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clock Records')
    XLSX.writeFile(wb, `clock-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const filteredMeetings = mockMeetings.filter(m => agentFilter === 'all' || m.agent_id === agentFilter)
  const filteredClients = mockClients.filter(c => agentFilter === 'all' || c.assigned_agent_id === agentFilter)
  const filteredClock = mockClockRecords.filter(r => agentFilter === 'all' || r.agent_id === agentFilter)

  const reportTypes = [
    {
      title: 'Meetings Report',
      description: 'All client meetings with agenda, outcome, GPS, and photo flags',
      icon: CalendarCheck,
      count: filteredMeetings.length,
      countLabel: 'meetings',
      onDownload: downloadMeetingsReport,
      stats: [
        { label: 'Successful', value: filteredMeetings.filter(m => m.outcome === 'successful').length },
        { label: 'Follow-up', value: filteredMeetings.filter(m => m.outcome === 'follow_up').length },
        { label: 'Lost', value: filteredMeetings.filter(m => m.outcome === 'lost_opportunity').length },
      ],
    },
    {
      title: 'Clients Report',
      description: 'Full client list with type, channel, agent assignment, and status',
      icon: Users,
      count: filteredClients.length,
      countLabel: 'clients',
      onDownload: downloadClientsReport,
      stats: [
        { label: 'Active', value: filteredClients.filter(c => c.status === 'active').length },
        { label: 'Lost', value: filteredClients.filter(c => c.status === 'lost').length },
        { label: 'Prospects', value: filteredClients.filter(c => c.customer_type === 'prospect').length },
      ],
    },
    {
      title: 'Clock Records Report',
      description: 'All clock in/out events with GPS coordinates and timestamps',
      icon: Clock,
      count: filteredClock.length,
      countLabel: 'records',
      onDownload: downloadClockReport,
      stats: [
        { label: 'Office', value: filteredClock.filter(r => r.type === 'office').length },
        { label: 'Event', value: filteredClock.filter(r => r.type === 'event').length },
        { label: 'Clock In', value: filteredClock.filter(r => r.action === 'in').length },
      ],
    },
  ]

  return (
    <div className="flex flex-col flex-1">
      <Header title="Reports" subtitle="Export data as Excel files" />

      <div className="flex-1 p-6 space-y-5">
        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <FileBarChart2 className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Filter by agent:</p>
          <Select value={agentFilter} onValueChange={v => setAgentFilter(v ?? 'all')}>
            <SelectTrigger className="w-48 h-9 bg-card border-border">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {agentFilter !== 'all' && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              Filtered: {agents.find(a => a.id === agentFilter)?.full_name}
            </Badge>
          )}
        </div>

        {/* Report cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reportTypes.map(({ title, description, icon: Icon, count, countLabel, onDownload, stats }) => (
            <Card key={title} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{count}</p>
                    <p className="text-xs text-muted-foreground">{countLabel}</p>
                  </div>
                </div>
                <CardTitle className="text-sm font-semibold text-foreground mt-2">{title}</CardTitle>
                <p className="text-xs text-muted-foreground">{description}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-2 mb-4">
                  {stats.map(s => (
                    <div key={s.label} className="flex-1 bg-muted/30 rounded-lg p-2 text-center">
                      <p className="text-sm font-semibold text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={onDownload}
                  className="w-full h-9 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-medium"
                  variant="outline"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download Excel
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Export note */}
        <p className="text-xs text-muted-foreground text-center">
          Reports are exported as .xlsx files and include all data visible to your admin account.
        </p>
      </div>
    </div>
  )
}
```

### `app/layout.tsx`

```tsx
import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "SalesApp Admin",
  description: "Sales Client Meeting Admin Panel",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster richColors theme="light" />
      </body>
    </html>
  )
}
```

### `app/login/page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-2xl bg-[oklch(0.22_0.06_145)] px-6 py-3 mb-4">
            <div className="relative h-12 w-44">
              <Image
                src="/oracle-logo.png"
                alt="Oracle logo"
                fill
                className="object-contain"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Admin Panel — Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@salesapp.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-input/50 border-border focus:border-primary h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-input/50 border-border focus:border-primary h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Restricted to authorized admin accounts only.
        </p>
      </div>
    </div>
  )
}
```

### `app/page.tsx`

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

---

## `lib/`

### `lib/mock/data.ts`

```ts
import type { Profile, Client, Meeting, ClockRecord, ClientEditRequest, DashboardMetrics } from '@/types'

export const mockProfiles: Profile[] = [
  { id: 'agent-1', user_id: 'u1', full_name: 'Cyril Santos', role: 'sales_specialist', team_id: 'team-1', created_at: '2024-01-10T08:00:00Z' },
  { id: 'agent-2', user_id: 'u2', full_name: 'Jun Reyes', role: 'sales_specialist', team_id: 'team-1', created_at: '2024-01-12T08:00:00Z' },
  { id: 'agent-3', user_id: 'u3', full_name: 'Maria Dela Cruz', role: 'sales_specialist', team_id: 'team-2', created_at: '2024-02-01T08:00:00Z' },
  { id: 'mgr-1', user_id: 'u4', full_name: 'Sir Eric Mendoza', role: 'sales_manager', team_id: 'team-1', created_at: '2024-01-05T08:00:00Z' },
  { id: 'mgr-2', user_id: 'u5', full_name: 'Sir Mike Lim', role: 'sales_manager', team_id: 'team-2', created_at: '2024-01-05T08:00:00Z' },
  { id: 'admin-1', user_id: 'u6', full_name: 'Admin User', role: 'admin', team_id: null, created_at: '2024-01-01T08:00:00Z' },
]

export const mockClients: Client[] = [
  {
    id: 'client-1', company_name: 'Oracle Petroleum', contact_person: 'Bong Aquino', contact_position: 'Procurement Manager',
    contact_number: '09171234567', office_address: '123 EDSA, Makati City', customer_type: 'existing',
    sales_channel: 'distributor', assigned_agent_id: 'agent-1', status: 'active',
    lost_at: null, reassignable_at: null, created_at: '2024-03-01T09:00:00Z', updated_at: '2024-06-01T09:00:00Z',
    agent: mockProfiles[0],
  },
  {
    id: 'client-2', company_name: 'San Basilica Beauty Corp', contact_person: 'Maricel Torres', contact_position: 'Owner',
    contact_number: '09281112222', office_address: 'Alabang, Muntinlupa', customer_type: 'new',
    sales_channel: 'dealer', assigned_agent_id: 'agent-1', status: 'active',
    lost_at: null, reassignable_at: null, created_at: '2024-05-10T09:00:00Z', updated_at: '2024-06-10T09:00:00Z',
    agent: mockProfiles[0],
  },
  {
    id: 'client-3', company_name: 'Bataan Industrial Supply', contact_person: 'Ramon Cruz', contact_position: 'CEO',
    contact_number: '09391234567', office_address: 'Mariveles, Bataan', customer_type: 'prospect',
    sales_channel: 'end_user', assigned_agent_id: 'agent-2', status: 'active',
    lost_at: null, reassignable_at: null, created_at: '2024-06-20T09:00:00Z', updated_at: '2024-06-20T09:00:00Z',
    agent: mockProfiles[1],
  },
  {
    id: 'client-4', company_name: 'Metro Fuel Distributors', contact_person: 'Lito Fernandez', contact_position: 'VP Sales',
    contact_number: '09451239876', office_address: 'Quezon City', customer_type: 'existing',
    sales_channel: 'distributor', assigned_agent_id: 'agent-3', status: 'lost',
    lost_at: '2024-06-10T00:00:00Z', reassignable_at: '2024-06-24T00:00:00Z', created_at: '2024-01-15T09:00:00Z', updated_at: '2024-06-10T09:00:00Z',
    agent: mockProfiles[2],
  },
  {
    id: 'client-5', company_name: 'Laguna Chemical Works', contact_person: 'Susan Ramos', contact_position: 'Director',
    contact_number: '09561237890', office_address: 'Calamba, Laguna', customer_type: 'new',
    sales_channel: 'end_user', assigned_agent_id: 'agent-2', status: 'active',
    lost_at: null, reassignable_at: null, created_at: '2024-04-20T09:00:00Z', updated_at: '2024-05-20T09:00:00Z',
    agent: mockProfiles[1],
  },
  {
    id: 'client-6', company_name: 'Starbucks Alabang', contact_person: 'Karen Go', contact_position: 'Area Manager',
    contact_number: '09671110000', office_address: 'Alabang Town Center', customer_type: 'prospect',
    sales_channel: 'private_label', assigned_agent_id: 'agent-3', status: 'active',
    lost_at: null, reassignable_at: null, created_at: '2024-06-18T09:00:00Z', updated_at: '2024-06-18T09:00:00Z',
    agent: mockProfiles[2],
  },
]

export const mockMeetings: Meeting[] = [
  {
    id: 'meet-1', client_id: 'client-1', agent_id: 'agent-1', recorded_by: null,
    meeting_type: 'f2f', online_platform: null, location_type: 'client_office', location_name: null,
    gps_lat: 14.5547, gps_lng: 121.0244, photo_url: null,
    agenda: ['New business opportunity', 'Price negotiation/quotation'],
    remarks: 'Client is interested in expanding the contract.', outcome: 'successful',
    contact_person: 'Bong Aquino', contact_position: 'Procurement Manager',
    meeting_date: '2024-06-25T10:00:00Z', created_at: '2024-06-25T10:05:00Z',
    client: mockClients[0], agent: mockProfiles[0],
  },
  {
    id: 'meet-2', client_id: 'client-2', agent_id: 'agent-1', recorded_by: 'mgr-1',
    meeting_type: 'f2f', online_platform: null, location_type: 'other', location_name: 'Starbucks Alabang',
    gps_lat: 14.4221, gps_lng: 121.0348, photo_url: null,
    agenda: ['Product/Company presentation', 'Relationship building'],
    remarks: 'First meeting. Client is receptive.', outcome: 'follow_up',
    contact_person: 'Maricel Torres', contact_position: 'Owner',
    meeting_date: '2024-06-24T14:00:00Z', created_at: '2024-06-24T14:10:00Z',
    client: mockClients[1], agent: mockProfiles[0], recorder: mockProfiles[3],
  },
  {
    id: 'meet-3', client_id: 'client-3', agent_id: 'agent-2', recorded_by: null,
    meeting_type: 'online', online_platform: 'zoom', location_type: 'client_office', location_name: null,
    gps_lat: null, gps_lng: null, photo_url: null,
    agenda: ['New business opportunity'],
    remarks: null, outcome: 'no_decision',
    contact_person: 'Ramon Cruz', contact_position: 'CEO',
    meeting_date: '2024-06-23T09:00:00Z', created_at: '2024-06-23T09:15:00Z',
    client: mockClients[2], agent: mockProfiles[1],
  },
  {
    id: 'meet-4', client_id: 'client-4', agent_id: 'agent-3', recorded_by: null,
    meeting_type: 'f2f', online_platform: null, location_type: 'client_office', location_name: null,
    gps_lat: 14.6507, gps_lng: 121.0496, photo_url: null,
    agenda: ['Negotiation (other matters)', 'Collection'],
    remarks: 'Client decided to go with a competitor.', outcome: 'lost_opportunity',
    contact_person: 'Lito Fernandez', contact_position: 'VP Sales',
    meeting_date: '2024-06-10T11:00:00Z', created_at: '2024-06-10T11:20:00Z',
    client: mockClients[3], agent: mockProfiles[2],
  },
  {
    id: 'meet-5', client_id: 'client-5', agent_id: 'agent-2', recorded_by: null,
    meeting_type: 'f2f', online_platform: null, location_type: 'client_office', location_name: null,
    gps_lat: 14.2291, gps_lng: 121.1613, photo_url: null,
    agenda: ['Closed deal'],
    remarks: 'Contract signed for 6 months.', outcome: 'successful',
    contact_person: 'Susan Ramos', contact_position: 'Director',
    meeting_date: '2024-06-22T13:00:00Z', created_at: '2024-06-22T13:30:00Z',
    client: mockClients[4], agent: mockProfiles[1],
  },
  {
    id: 'meet-6', client_id: 'client-6', agent_id: 'agent-3', recorded_by: null,
    meeting_type: 'online', online_platform: 'googlemeet', location_type: 'other', location_name: 'Google Meet',
    gps_lat: null, gps_lng: null, photo_url: null,
    agenda: ['Product/Company presentation', 'New business opportunity'],
    remarks: 'Promising lead. Needs follow up next week.', outcome: 'follow_up',
    contact_person: 'Karen Go', contact_position: 'Area Manager',
    meeting_date: '2024-06-21T15:00:00Z', created_at: '2024-06-21T15:10:00Z',
    client: mockClients[5], agent: mockProfiles[2],
  },
]

export const mockEditRequests: ClientEditRequest[] = [
  {
    id: 'req-1', client_id: 'client-1', requested_by: 'agent-1',
    changes: { sales_channel: { old: 'distributor', new: 'dealer' } },
    status: 'pending', reviewed_by: null, reviewed_at: null, created_at: '2024-06-25T11:00:00Z',
    client: mockClients[0], requester: mockProfiles[0],
  },
  {
    id: 'req-2', client_id: 'client-5', requested_by: 'agent-2',
    changes: { customer_type: { old: 'new', new: 'existing' }, contact_number: { old: '09561237890', new: '09561237891' } },
    status: 'approved', reviewed_by: 'mgr-1', reviewed_at: '2024-06-24T10:00:00Z', created_at: '2024-06-23T09:00:00Z',
    client: mockClients[4], requester: mockProfiles[1], reviewer: mockProfiles[3],
  },
  {
    id: 'req-3', client_id: 'client-3', requested_by: 'agent-2',
    changes: { contact_person: { old: 'Ramon Cruz', new: 'Ramon C. Cruz Jr.' } },
    status: 'rejected', reviewed_by: 'mgr-1', reviewed_at: '2024-06-22T14:00:00Z', created_at: '2024-06-22T08:00:00Z',
    client: mockClients[2], requester: mockProfiles[1], reviewer: mockProfiles[3],
  },
]

export const mockClockRecords: ClockRecord[] = [
  {
    id: 'clk-1', agent_id: 'agent-1', type: 'office', action: 'in',
    gps_lat: 14.5547, gps_lng: 121.0244, photo_url: null, event_name: null,
    timestamp: '2024-06-25T08:02:00Z', created_at: '2024-06-25T08:02:00Z', agent: mockProfiles[0],
  },
  {
    id: 'clk-2', agent_id: 'agent-1', type: 'office', action: 'out',
    gps_lat: 14.5547, gps_lng: 121.0244, photo_url: null, event_name: null,
    timestamp: '2024-06-25T18:00:00Z', created_at: '2024-06-25T18:00:00Z', agent: mockProfiles[0],
  },
  {
    id: 'clk-3', agent_id: 'agent-2', type: 'event', action: 'in',
    gps_lat: 14.5995, gps_lng: 120.9842, photo_url: null, event_name: 'Trade Fair PICC 2024',
    timestamp: '2024-06-24T09:00:00Z', created_at: '2024-06-24T09:00:00Z', agent: mockProfiles[1],
  },
  {
    id: 'clk-4', agent_id: 'agent-2', type: 'event', action: 'out',
    gps_lat: 14.5995, gps_lng: 120.9842, photo_url: null, event_name: 'Trade Fair PICC 2024',
    timestamp: '2024-06-24T17:30:00Z', created_at: '2024-06-24T17:30:00Z', agent: mockProfiles[1],
  },
  {
    id: 'clk-5', agent_id: 'agent-3', type: 'office', action: 'in',
    gps_lat: 14.4221, gps_lng: 121.0348, photo_url: null, event_name: null,
    timestamp: '2024-06-25T07:55:00Z', created_at: '2024-06-25T07:55:00Z', agent: mockProfiles[2],
  },
]

export const mockDashboardMetrics: DashboardMetrics = {
  totalMeetings: 24,
  meetingsByType: { existing: 10, new: 8, prospect: 6 },
  successfulByType: { existing: 7, new: 5, prospect: 2 },
  closedDeals: 3,
  monthlyTrend: [
    { month: 'Jan', total: 12, successful: 8 },
    { month: 'Feb', total: 15, successful: 10 },
    { month: 'Mar', total: 18, successful: 11 },
    { month: 'Apr', total: 20, successful: 13 },
    { month: 'May', total: 22, successful: 15 },
    { month: 'Jun', total: 24, successful: 14 },
  ],
}
```

### `lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `lib/supabase/server.ts`

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

### `lib/utils.ts`

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## `types/`

### `types/index.ts`

```ts
export type UserRole = 'admin' | 'sales_manager' | 'sales_specialist'
export type CustomerType = 'existing' | 'new' | 'prospect'
export type SalesChannel = 'distributor' | 'dealer' | 'end_user' | 'private_label'
export type ClientStatus = 'active' | 'lost' | 'deleted'
export type MeetingType = 'f2f' | 'online'
export type OnlinePlatform = 'zoom' | 'googlemeet'
export type LocationType = 'client_office' | 'other'
export type MeetingOutcome = 'successful' | 'follow_up' | 'no_decision' | 'lost_opportunity'
export type ClockType = 'office' | 'event'
export type ClockAction = 'in' | 'out'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  user_id: string
  full_name: string
  role: UserRole
  team_id: string | null
  created_at: string
}

export interface Team {
  id: string
  name: string
  manager_id: string
  created_at: string
}

export interface Client {
  id: string
  company_name: string
  contact_person: string
  contact_position: string | null
  contact_number: string
  office_address: string
  customer_type: CustomerType
  sales_channel: SalesChannel
  assigned_agent_id: string
  status: ClientStatus
  lost_at: string | null
  reassignable_at: string | null
  created_at: string
  updated_at: string
  agent?: Profile
}

export interface ClientEditRequest {
  id: string
  client_id: string
  requested_by: string
  changes: Record<string, { old: unknown; new: unknown }>
  status: ApprovalStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  client?: Client
  requester?: Profile
  reviewer?: Profile
}

export interface Meeting {
  id: string
  client_id: string
  agent_id: string
  recorded_by: string | null
  meeting_type: MeetingType
  online_platform: OnlinePlatform | null
  location_type: LocationType
  location_name: string | null
  gps_lat: number | null
  gps_lng: number | null
  photo_url: string | null
  agenda: string[]
  remarks: string | null
  outcome: MeetingOutcome
  contact_person: string
  contact_position: string | null
  meeting_date: string
  created_at: string
  client?: Client
  agent?: Profile
  recorder?: Profile
}

export interface ClockRecord {
  id: string
  agent_id: string
  type: ClockType
  action: ClockAction
  gps_lat: number | null
  gps_lng: number | null
  photo_url: string | null
  event_name: string | null
  timestamp: string
  created_at: string
  agent?: Profile
}

export interface DashboardMetrics {
  totalMeetings: number
  meetingsByType: { existing: number; new: number; prospect: number }
  successfulByType: { existing: number; new: number; prospect: number }
  closedDeals: number
  monthlyTrend: { month: string; total: number; successful: number }[]
}
```

---

## `components/`

### `components/header.tsx`

```tsx
'use client'

import { Bell } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  pendingApprovals?: number
}

export function Header({ title, subtitle, pendingApprovals = 0 }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 h-[61px] border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          {pendingApprovals > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
      </div>
    </header>
  )
}
```

### `components/sidebar.tsx`

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, CalendarCheck, ClipboardCheck,
  AlertTriangle, Clock, FileBarChart2, LogOut,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/meetings', label: 'Meetings', icon: CalendarCheck },
  { href: '/approvals', label: 'Approvals', icon: ClipboardCheck },
  { href: '/lost-opportunities', label: 'Lost Opportunities', icon: AlertTriangle },
  { href: '/clock-records', label: 'Clock Records', icon: Clock },
  { href: '/reports', label: 'Reports', icon: FileBarChart2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; initials: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name =
          data.user.user_metadata?.full_name ||
          data.user.email?.split('@')[0] ||
          'Admin User'
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
        setUser({ name, initials })
      }
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col h-screen w-60 bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="flex items-center h-[61px] px-4 border-b border-sidebar-border bg-[oklch(0.22_0.06_145)]">
        <div className="relative h-9 w-40 shrink-0">
          <Image
            src="/oracle-logo.png"
            alt="Oracle logo"
            fill
            className="object-contain object-left"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User profile + Logout */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {user?.initials ?? 'AD'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.name ?? 'Admin User'}
            </p>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-primary/40 text-primary h-4 mt-0.5"
            >
              Admin
            </Badge>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  )
}
```

### `components/ui/alert.tsx`

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
```

### `components/ui/avatar.tsx`

```tsx
"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
```

### `components/ui/badge.tsx`

```tsx
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
```

### `components/ui/button.tsx`

```tsx
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

### `components/ui/card.tsx`

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
```

### `components/ui/dialog.tsx`

```tsx
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
```

### `components/ui/dropdown-menu.tsx`

```tsx
"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"
import { ChevronRightIcon, CheckIcon } from "lucide-react"

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn("z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn("w-auto min-w-[96px] rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon
          />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon
          />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
```

### `components/ui/input.tsx`

```tsx
import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
```

### `components/ui/label.tsx`

```tsx
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
```

### `components/ui/select.tsx`

```tsx
"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn("relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
```

### `components/ui/separator.tsx`

```tsx
"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
```

### `components/ui/skeleton.tsx`

```tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

### `components/ui/sonner.tsx`

```tsx
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
```

### `components/ui/table.tsx`

```tsx
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
```

### `components/ui/tabs.tsx`

```tsx
"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
```

### `components/ui/textarea.tsx`

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
```

---

_Auto-generated by `scripts/sync-web-status.mjs`. Do not edit manually._