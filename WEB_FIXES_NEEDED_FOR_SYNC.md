# Web fixes needed before mobile can sync (Collection & Delivery)

> For the web/admin repo (github.com/Cedie99/OracleSalesApp-Web).
> Tables `043`/`044` are deployed and mobile is aligned to them. Only the item
> below blocks mobile from syncing the real lists.

## 🚧 REQUIRED — denormalize the customer name onto the list rows

**Why:** `collection_visits` and `purchase_orders` store only `client_id`. After
migrations `030`/`031`, the `collector` and `delivery` roles have **no RLS read
on `clients`**, so the mobile app cannot resolve `client_id` → name. Every list
row would show a blank customer. The admin publishes these rows, so store the
name on the row itself.

### 1. Migration — add + backfill the columns

New file `supabase/migrations/045_denormalize_client_on_lists.sql` (or run the
`ALTER`/`UPDATE` directly in Supabase → SQL Editor since the DB is already live,
then also commit the file so the repo matches):

```sql
ALTER TABLE collection_visits ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE collection_visits ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE purchase_orders   ADD COLUMN IF NOT EXISTS client_name TEXT;
-- purchase_orders already has `area`.

-- Backfill rows already entered (migration runs with full access):
UPDATE collection_visits v
SET client_name = c.company_name, area = COALESCE(v.area, c.city)
FROM clients c WHERE c.id = v.client_id;

UPDATE purchase_orders p
SET client_name = c.company_name
FROM clients c WHERE c.id = p.client_id;
```

### 2. Write the name on insert (admin forms)

The client picker already has the selected client's `company_name`/`city`, so
carry them into the insert:

- `lib/hooks/use-collection.ts` → `.from('collection_visits').insert({ … })`:
  add `client_name: <selected company_name>` and `area: <selected city>`.
- `lib/hooks/use-delivery.ts` → `.from('purchase_orders').insert({ … })`:
  add `client_name: <selected company_name>` (`area` is already written).

### 3. Verify

Add a store/PO in admin → confirm the Supabase row has `client_name` filled →
mobile (logged in as collector/driver) shows the name + area.

**Once this is done, mobile can sync.** No other web change is required for the
core read/write flow — the RLS already lets field roles read the whole day's
list, claim any unclaimed row (UPDATE), and INSERT their own remittances.

---

## Optional / later (not blocking sync)

- **Claimed / en-route ("On the way") state.** Mobile shows an "On the way"
  indicator, but it's mock-only — web's schema has no claimed state (a pending
  row must have `collector_id`/`driver_id` NULL). To make it real: add a
  `claimed_by` / `claimed_at` (or an `in_progress` status), relax the
  `*_pending_is_unworked` / `*_is_unrun` constraint, add a claim/release RLS
  path, and realtime so other phones see the claim. Open Qs: soft hint vs lock;
  does a claim auto-expire.
