# Store Locations on the C&D Map — cross-repo contract

> Maintained by the **mobile** repo (`OracleSalesApp-Mobile`) for the **web/admin**
> repo (`OracleSalesApp-Web`). Companion to `PARTIAL_COLLECTION_CONTRACT.md`,
> `PARTIAL_COD_CONTRACT.md`, `REMITTANCE_CONTRACT.md`,
> `COLLECTION_DELIVERY_STATUS_MOBILE.md` and `WEB_FIXES_NEEDED_FOR_SYNC.md`.
> Created: 2026-08-17.
>
> **TL;DR:** Collection & Delivery officers need a **map** of the day's stores,
> and the ability to **set a store's real location on the ground** — because some
> stores relocate and their registered pin is stale or missing. A store therefore
> keeps a **numbered list** of candidate locations (Location 1, 2, 3…), one marked
> current. The field officer sets it **directly** (no admin approval). Persisting +
> sharing that list needs a new **web-owned** table; mobile has built the local-
> first half against the shape below.

## The decisions (owner, 2026-08-17)

1. **Numbered locations, not a single overwrite.** Each relocation is appended as
   "Location N" and kept. One row is `is_current`. History is preserved (a store
   that moves back can re-select an old pin).
2. **Both roles** — collection and delivery — get the map and the set-location UI.
3. **Field officer sets it directly.** The collector/driver's new pin is
   immediately official. No admin approval/proposal step. (Web may still *edit*
   locations from the admin side, but that is not required for this feature.)

## What a "store location" actually is today

- The store's registered pin lives on the **client** record: `clients.office_lat`
  / `office_lng` (the existing Office Location / office-pin system). Field devices
  must actually **sync those client rows** for the map fallback to work — see the
  ⚠️ dependency below.
- `collection_visits` / `purchase_orders` only carry **visit-time GPS**
  (`gps_lat`/`gps_lng`), captured with the proof photo — where the officer *was*,
  and only present AFTER the stop is worked. This is a weak fallback, not a
  registered location.
- There is **no** concept of multiple/alternate locations anywhere in the schema.
  That is the gap this contract fills.

Mobile plots each store by this precedence (`lib/store-location-resolver.ts`):
`current client_location → client office pin → visit GPS → "location not set"`.

## Why this is blocked on WEB

The numbered list must be a real table so a location set by one officer reaches
the admin board and every other field device. `types/database.ts` is generated
from Supabase and has **no `client_locations`**, so mobile's generic sync lanes
(`entity-registry.ts` / `remote-upsert.ts` / `entity-appliers.ts`) can't be wired
to it yet — a push would throw a PostgREST error on a non-existent table (same
failure class as partial COD before web 073). Until the table + regenerated types
ship, a set location lives **only on the device that set it**.

---

## 👉 What WEB must add

### 1. A `client_locations` table

```sql
CREATE TABLE client_locations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  seq         integer NOT NULL,               -- 1,2,3… "Location N" (per client)
  label       text,                           -- optional ("Warehouse", "New site")
  lat         numeric NOT NULL,
  lng         numeric NOT NULL,
  is_current  boolean NOT NULL DEFAULT false, -- exactly one true per client
  source      text NOT NULL DEFAULT 'field_set', -- field_set | office_pin | admin | migrated
  set_by      uuid REFERENCES profiles(id),   -- the field officer who set it
  set_by_name text,                           -- denormalized for display, like claimed_by_name
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON client_locations (client_id);
-- one current pin per client:
CREATE UNIQUE INDEX client_locations_one_current
  ON client_locations (client_id) WHERE is_current;
```

The mobile local mirror already matches this shape (SQLite `client_locations`,
column-for-column apart from Postgres types).

### 2. "Set current" semantics (server-side, so it can't race two currents)

Setting a new/relocated pin must, atomically for that `client_id`:
- flip the previously-current row's `is_current = false`, and
- insert (or promote) the chosen row with `is_current = true`.

A `SECURITY DEFINER` RPC is the clean way (e.g. `set_client_location(client_id,
lat, lng, label)` that appends the next `seq` and flips current in one statement),
so RLS doesn't have to allow a broad UPDATE across sibling rows. Numbering
(`seq = COALESCE(MAX(seq),0)+1` per client) should be assigned **server-side** to
avoid two offline devices both minting "Location 3".

### 3. RLS

- A collection/delivery field role may **INSERT** a `client_locations` row for a
  client on their day list, and flip `is_current` (via the RPC), and **SELECT**
  the locations of clients in their scope. **No admin approval** (owner decision).
- Admin: full read/write.

### 4. Sync-down — two things the field-role pull must include

- **`client_locations`** for the clients on the officer's day list (so the numbered
  list + current pin reach the phone).
- 🔴 **REQUIRED — the store's DEFAULT/registered coordinate must reach the field
  device.** Owner requirement (2026-08-18): a collection/delivery officer must see
  each store's default location on the map *before* they set out — that is how they
  know where to go; the set-location feature is only for when they arrive and find
  the store has relocated. This does NOT work on the field device today, confirmed
  in code:
  - The `clients` sync-down is scoped `assigned_agent_id = <me>`
    (`lib/sync-down.ts` `AGENT_SCOPED_COLUMN.clients`). A collector/driver is not
    the *sales* agent who owns those clients, so their `clients` pull returns **zero
    rows** — `clients.office_lat/office_lng` is simply absent on their device.
  - `collection_visits` / `purchase_orders` carry only `gps_lat/gps_lng`
    (**visit-time** GPS, present only AFTER a stop is worked) — no store coordinate.
    A pending, unvisited store has **no** coordinate anywhere on the device.

  **✅ Recommended fix (cheapest, matches existing denormalization): add
  `client_lat` / `client_lng` to `collection_visits` AND `purchase_orders`**,
  populated from the client's current `client_locations` pin if one exists else the
  office pin, exactly the way `client_name` / `area` / `claimed_by_name` are already
  denormalized onto those rows. Mobile then reads them straight off the synced
  visit/PO row — no `clients` RLS/sync widening needed. (Alternative: widen the
  `clients` RLS + sync-down so field roles pull the referenced client rows — more
  surface area, more risk.) Mobile's map resolver already has an `officePin` slot
  for exactly this default; wiring it to read the denormalized columns is a small,
  self-contained mobile change (see open question below).

### 4a. 🔴 Default-location denormalization — ready-to-apply web spec

Adding the columns is **not enough on its own** — three web-side pieces are needed
(only the first is pure SQL). This is the concrete hand-off for the recommended fix.

**Step 1 — schema (one-time migration).** Nullable, so it's additive and safe:

```sql
ALTER TABLE collection_visits ADD COLUMN IF NOT EXISTS client_lat numeric;
ALTER TABLE collection_visits ADD COLUMN IF NOT EXISTS client_lng numeric;
ALTER TABLE purchase_orders   ADD COLUMN IF NOT EXISTS client_lat numeric;
ALTER TABLE purchase_orders   ADD COLUMN IF NOT EXISTS client_lng numeric;
```

**Step 2 — one-time backfill** for rows that already exist. Precedence = the
client's current relocation pin, else the office pin (`client_locations` may not
exist yet — the `LEFT JOIN` degrades to office-pin-only until it does):

```sql
UPDATE collection_visits v SET
  client_lat = COALESCE(cl.lat, c.office_lat),
  client_lng = COALESCE(cl.lng, c.office_lng)
FROM clients c
LEFT JOIN client_locations cl
  ON cl.client_id = c.id AND cl.is_current
WHERE v.client_id = c.id;

UPDATE purchase_orders p SET
  client_lat = COALESCE(cl.lat, c.office_lat),
  client_lng = COALESCE(cl.lng, c.office_lng)
FROM clients c
LEFT JOIN client_locations cl
  ON cl.client_id = c.id AND cl.is_current
WHERE p.client_id = c.id;
```

**Step 3 — populate-on-write (the actual app-code change).** Wherever the admin
**publishes the day's list / creates a visit or PO**, set `client_lat`/`client_lng`
from the same `COALESCE(current client_locations pin, office pin)` at insert time —
right alongside where the flow already denormalizes `client_name` / `area`. This is
the piece a migration can't do; it lives in the web publish/create code.

**Step 3b — keep-fresh (recommended, owner's call on how live).** If a store
relocates *after* its visit/PO was published, the copied coordinate goes stale.
Two options:
- *Push on relocation:* have `set_client_location()` (the §2 RPC) also re-copy the
  new pin onto that client's still-open (`pending`/`partial`) visits & POs. Keeps
  the map live same-day. Recommended.
- *Refresh on next publish:* accept staleness until the list is next published.
  Zero extra code, but a same-day relocation by one officer won't reach another
  officer's map until the admin republishes.

**Step 4 — sync-down.** No new pull needed: `client_lat`/`client_lng` ride the
existing `collection_visits` / `purchase_orders` pull (`applyScope: whole-day`,
already role-gated by RLS). Mobile just maps the two new columns.

**Mobile follow-up (small, ~30 min, done AFTER web ships so it's testable):** add
`client_lat`/`client_lng` to the local `collection_visits`/`purchase_orders` tables
(additive columns), map them in `rowToStore`/`rowToPo`, and feed them as the
resolver's `officePin` input in `lib/use-store-location-map.ts`. Then a store's
default pin shows the moment its row syncs — verified end-to-end against real data.

> ✅ **WEB SHIPPED (staging, migrations 113 + 114) and MOBILE WIRED (2026-08-20).**
> Web 113 = `client_locations` table + `set_client_location()` /
> `set_current_client_location()` RPCs + RLS. Web 114 = `client_lat`/`client_lng`
> on `collection_visits`/`purchase_orders` + backfill + populate-on-insert trigger
> + keep-fresh in `set_client_location()`. Mobile default-location wiring (this
> paragraph) done: `ensureClientCoordinateColumns` (db.ts), the two appliers
> (entity-appliers.ts), `rowToStore`/`rowToPo`, `CollectionStore`/`DeliveryPo`,
> both `map.tsx` route wrappers, and `use-store-location-map.ts` (denormalized pin
> preferred over the local `clients` office pin). Needs an on-device pass against
> real synced data to confirm.

---

## ✅ What MOBILE has built (2026-08-17, Phase 0 + 1 — web-blocked for sync)

Local-first data layer, no remote wiring yet (activates when the web table +
regenerated types land):

- **Local `client_locations` table** — created in `ensureCriticalTablesExist`
  (`lib/db.ts`) so it exists on every device regardless of the `LATEST_SCHEMA_VERSION`
  early-return, same additive-table reasoning as `collection_payments` /
  `cod_payments` (B-111).
- **`lib/store-location-service.ts`** — `addStoreLocation()` (append next
  "Location N", make current, demote old), `setCurrentStoreLocation()` (re-select
  a saved pin), `listStoreLocations()` / `getCurrentStoreLocation()`. Reuses
  office-pin-service's **Philippines coordinate guard**, and writes
  `sync_status='pending'` as the hook for the future push lane.
- **`lib/store-location-resolver.ts`** — the pure precedence resolver above
  (field_set → office_pin → visit_gps → null), with unit tests.
- **`lib/use-store-locations.ts`** — fetch-on-mount + refresh-on-sync hook.

### Phase 2 + 3 shipped (2026-08-18, UI — still local-first)

- **Shared map screen** — `components/maps/StoreLocationsMapScreen.tsx`, rendered
  by `app/(collection)/map.tsx` and `app/(delivery)/map.tsx` (thin role wrappers),
  reached from a new **"Store Map"** Quick Action on both dashboards. Plots each
  store by the resolver (field pin / office pin / visit GPS, color-coded + legend),
  shows the "you are here" marker, taps a pin to open the visit/PO, and buckets
  stores with no coordinate into a **"Location not set"** list.
- **`lib/use-store-location-map.ts`** — resolves a day's list into located /
  unlocated buckets by batch-reading local office pins (`clients`) + current
  `client_locations`; re-runs on sync-down. Gracefully leaves a store "unlocated"
  when the ⚠️ `clients` dependency below isn't met (no crash).
- **Set/add-location UI** — `components/maps/SetStoreLocationScreen.tsx`, rendered
  by `app/(collection)/set-location.tsx` + `app/(delivery)/set-location.tsx`. A
  draggable pin **or** "Use my GPS", saved via `addStoreLocation` as the next
  "Location N" (immediately current, no approval); the numbered saved-location
  list lets the officer re-select an older pin (`setCurrentStoreLocation`).
- `CollectionStore` / `DeliveryPo` now carry `clientId` (mapped from
  `collection_visits.client_id` / `purchase_orders.client_id`) so a store can be
  tied to its `client_locations` + office pin.

### Phase 4 push shipped (2026-08-20, web 113/114 landed)

- **Push reconciler** `lib/sync/store-location-push.ts` (modeled on
  `additional-acks.ts`) runs in `sync-engine.ts` BEFORE `syncDown` while online:
  a pending `client_locations` row with `remote_id IS NULL` is a NEW pin →
  `set_client_location(client_id, lat, lng, label)`, and the returned server id is
  stored in the new local `remote_id` column; a pending row that already has
  `remote_id` is a re-select → `set_current_client_location(remote_id)`. Rows push
  oldest-first (seq ASC) so the newest ends up current server-side. RPC types
  added to `types/database.ts`; `remote_id` added to the local table (db.ts).
- **Cross-device correctness comes from 114's keep-fresh + the default-location
  wiring above**, NOT a `client_locations` down-sync: when a pin is pushed, 114
  re-stamps `client_lat`/`client_lng` on the client's still-open visits/POs, which
  ride the existing visit/PO pull back onto every officer's map the same pass.

### Officer-typed relocation AREA (2026-08-20, mobile Option 2)

Problem: the store header shows the customer's **registered city** (`collection_visits/
purchase_orders.area`, denormalized from `clients.city` at customer creation). Setting
a relocation **pin** changes the coordinate, not that text, so a relocated store's
header stayed stale. Fix (owner chose Option 2 — pick it, no geocoder): the set-location screen has an
optional **"Area / municipality"** field using the **same canonical PSGC picker
(`CityMunicipalitySelector`) as the sales Create Client flow** — no free text, so a
collector/driver's area is a real locality (not an arbitrary string that only reads
right because the header hardcodes ", Bataan"). Only the municipality NAME is stored
(matching `clients.city = selectedLocality.name`), on the local `client_locations`
`area` column, and via a correlated subquery in `use-collection-delivery.ts` it
**overrides `area`** in `rowToStore`/`rowToPo` — so every page reading the store (day
list, Collect Payment, Deliver PO, map) shows the new area. `StoreLocationCard` shows
the pin on those detail screens. Note: the ", Bataan" province suffix is hardcoded in
the screens for EVERY store (sales-created too) — an app-wide operating-province
assumption, not per-record data; unchanged here to stay consistent with sales/RSR.

🔴 **WEB owes, for the typed area to reach web/admin + other devices** (today it's
local to the setting device, like the pin's field_set tier): add an **`area`** column
to `client_locations` + an `p_area` param on `set_client_location()`, and either
denormalize it onto the visits/POs (like `client_lat/lng`, so it rides the existing
pull) **or** ship the deferred `client_locations` down-sync. Mobile's push
(`store-location-push.ts`) will pass it once the RPC accepts it.

### `client_locations` down-sync SHIPPED (2026-08-21) — verified push works first

On-DB verification (staging `xhxjbzesuzprwdelrdwh`, 2026-08-21): 113 + 114 deployed
(both RPCs + all four `client_lat`/`client_lng` columns present), and the mobile PUSH
works — real `field_set` rows from multiple officers (`set_by_name` populated) are on
the server. So the down-sync has real data.

- **`lib/sync/store-location-sync-down.ts`** runs in `sync-engine.ts` AFTER `syncDown`
  (gated to collector/delivery). A plain `select` on `client_locations` is auto-scoped
  by 113's RLS (a field role reads pins for any client on their board), so it pulls
  OTHER officers' pins too. Applies them to the local mirror **as real `field_set`
  rows** — restoring the "Field pin · set by X · when" trust signal that the
  denormalized coordinate (114) loses. Dedup: match the device's own pushed row by
  `remote_id`, else insert under the server id; never overwrites a still-`pending`
  local edit. `client_locations` table type added to `types/database.ts`.
- **`StoreLocationCard`** now shows **"Relocated · set by {name} · {when}"** whenever
  the resolved origin is `field_set` — so a co-worker opening the stop sees a colleague
  moved it and who/when, not just a silently-relocated dot.
- **Still local-only:** `area`/`province` (web's `client_locations` has no such
  columns; the down-sync intentionally doesn't touch them). Co-workers get the correct
  pin + who/when; the municipality/province TEXT still needs the web add below.

## §area+branch — Relocation vs. additional branch + additive municipality (2026-08-22)

Owner decision (2026-08-22), refining the officer-typed AREA feature above. Two
things changed, both **additive and non-destructive**:

### The model

1. **Field officers now declare intent when setting a location.** The
   set-location screen asks: **"Store moved here"** vs **"Additional branch."**
   These are deliberately *different weights*:
   - **Relocation** — the SAME store moved. Becomes the store's **current** pin;
     its picked municipality overrides the store header (as before). This is the
     existing field-direct behavior (no approval).
   - **Additional branch** — a **SEPARATE second store** at the same client.
     Saved as a **NON-current, flagged** entry. It must **never** become the
     store's current pin and **never** override the account's registered area.
     A field tap must not silently fork a billable account — admin/sales decides
     if a branch becomes a real account. Mobile only *raises the flag*.

2. **The registered (sales/RSR-set) municipality is never replaced — only added
   to.** If Sales set the client's city to *Quezon City* and a collector sets a
   relocation area of *Bulacan*, **both** are kept and shown together
   (*"Registered: Quezon City · Now at: Bulacan · set by {name}"*). The
   field-observed value is ground-truth-for-humans; the **registered value stays
   authoritative for territory, reporting, and RSR assignment** unless admin
   explicitly promotes the field value. Do NOT let a field area silently drive
   assignment/reporting logic.

### What MOBILE built (local-first, this repo, 2026-08-22)

- `client_locations.kind` column (`'relocation'` | `'additional_branch'`, default
  `'relocation'`) — db.ts + `addStoreLocation` (a branch inserts `is_current=0`
  and does not demote the current pin). `StoreLocation.kind` on the model.
- Set-location screen: segmented **"Store moved here / Additional branch"**
  selector, a **"Registered area: …"** context line, kind-aware save copy, and a
  **"Branch"** badge (branches aren't re-selectable as current) in the saved list.
- `CollectionStore` / `DeliveryPo` now carry **`registeredArea`** (the original
  `visits/POs.area`, preserved unconditionally alongside the possibly-overridden
  `area`). `StoreLocationCard` shows both when they differ.
- Push/down-sync unchanged on the wire (see below) — `kind`/`area`/`province`
  remain **local-only** until web adds the params.

### 👉 What WEB must add (so both values + the branch flag reach all roles)

Until this ships, a branch flag and the field municipality live **only on the
setting device** — the RSR/admin/other officers will NOT see them.

1. **Columns on `client_locations`:**
   ```sql
   ALTER TABLE client_locations ADD COLUMN IF NOT EXISTS area     text;
   ALTER TABLE client_locations ADD COLUMN IF NOT EXISTS province text;
   ALTER TABLE client_locations ADD COLUMN IF NOT EXISTS kind     text NOT NULL DEFAULT 'relocation';
   -- kind ∈ ('relocation','additional_branch')
   ```
2. **RPC params on `set_client_location()`** — add `p_area text`, `p_province
   text`, `p_kind text default 'relocation'`. Persist them on the inserted row.
   **Crucially:** when `p_kind = 'additional_branch'`, insert the row with
   `is_current = false` and **do NOT** flip the client's current pin, and **do
   NOT** re-stamp `client_lat/lng` on the visits/POs (114 keep-fresh) — a branch
   is not the store's location. Only a relocation touches current/keep-fresh.
3. **Down-sync** — include `area`, `province`, `kind` in whatever field roles read
   (the denormalized visit/PO area column, or the `client_locations` pull). Mobile
   already reads `area`/`province` locally and will map `kind` from the pull the
   moment it's returned.
4. **Sales/RSR + admin UI (the "visible in all records" part):** on the client /
   store record, show the **field-observed municipality alongside** the registered
   one (do not overwrite the registered field). Show **who/when** (`set_by_name`,
   `captured_at`). Surface **additional-branch** rows as a distinct, triageable
   list — this is where admin decides whether a branch becomes a real account. The
   registered municipality remains the value that feeds territory/assignment until
   admin promotes a field value.

## Open questions for the owner / web

- **Which client rows sync to field devices?** (the ⚠️ dependency above) — decides
  whether the office-pin fallback works or we must denormalize lat/lng onto the
  visit/PO.
- **Offline numbering collisions:** two officers offline both add "Location 3" to
  the same store. Server-assigned `seq` (per §2) resolves display order, but do we
  keep both pins, or dedupe by proximity? Mobile currently keeps both.
- **Can a field officer edit/delete a wrong pin**, or only append a new current one?
  Mobile currently only appends + re-selects (never deletes).
