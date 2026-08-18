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

### Still to come (mobile)

- **Phase 4 (web-gated):** wire `client_locations` into the sync lanes + a push
  processor once the web table ships and `types/database.ts` is regenerated. Until
  then a set location lives only on the device that set it.

## Open questions for the owner / web

- **Which client rows sync to field devices?** (the ⚠️ dependency above) — decides
  whether the office-pin fallback works or we must denormalize lat/lng onto the
  visit/PO.
- **Offline numbering collisions:** two officers offline both add "Location 3" to
  the same store. Server-assigned `seq` (per §2) resolves display order, but do we
  keep both pins, or dedupe by proximity? Mobile currently keeps both.
- **Can a field officer edit/delete a wrong pin**, or only append a new current one?
  Mobile currently only appends + re-selects (never deletes).
