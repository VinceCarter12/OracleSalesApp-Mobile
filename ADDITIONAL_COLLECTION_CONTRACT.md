# Additional Collection — cross-repo contract

> Maintained by the **mobile** repo (`OracleSalesApp-Mobile`), for the **web/admin**
> repo (`OracleSalesApp-Web`). Companion to `COLLECTION_DELIVERY_STATUS_MOBILE.md`.
> Created: 2026-08-07.
>
> **TL;DR:** the admin can add a store to a collector's already-published day
> list ("this store wasn't for collection today, but now it is"). Mobile now
> models that as an **Additional** store — badged + floated to the top of the
> list. The mobile half of Phase A is built; the web half (a column + the SMS
> fallback + two acknowledgment columns) is what this doc hands off.

## The problem we're solving

The admin (web) publishes each collector's day list. Sometimes, *after* it's
published, the admin urgently needs the collector to also hit a store that
wasn't originally on the list. Two things have to happen:

1. That store must appear on the collector's app **mid-day**, and be **hard to
   miss**.
2. It must arrive even when the collector is in a **weak- or no-signal** area —
   and the admin needs to **know whether it actually landed**.

You can't push data to a phone with zero signal (physics). So the design goal
is: **deliver the instant any signal returns, make it unmissable when it lands,
and give the admin visibility (plus an SMS fallback) when it doesn't.**

## The agreed solution (5 parts)

| # | Feature | Owner | Status |
| - | --- | --- | --- |
| 1 | `is_additional` flag on the visit → badge + float-to-top in the app | **mobile** | ✅ Built (Phase A, this note) |
| 2 | Deliver the instant signal returns | mobile | ✅ **Already existed** — `lib/use-sync.ts` syncs on every reconnect (`NetInfo` online flip) + a 30s foreground drain. No new work needed. |
| 3 | Acknowledgment: **received-by-phone** (auto) **and** seen-by-collector (manual) — two separate signals | **web + mobile** | ⏳ Phase B — blocked on web columns + RLS (below) |
| 4 | **SMS fallback** via BusyBee for dead zones | **web** | ⏳ Web-owned (below) |
| 5 | Admin dashboard shows Delivered/Viewed vs Pending, so a human can call | web | ⏳ Web-owned (consumes #3) |

Naming decision: the feature is called **"Additional"** (not "urgent") — it
describes *what* the row is (added after publish), and reads cleanly on both
the app row badge and the admin board.

---

## ✅ What mobile already built (Phase A)

All safe to ship now — inert until web sets the flag, so nothing changes for a
normal published row.

- **`collection_visits.is_additional`** carried end-to-end: local SQLite column
  (migration → schema v24, additive `INTEGER NOT NULL DEFAULT 0`), the
  sync-down applier (`upsertSyncedCollectionVisit`), the row mapper
  (`CollectionStore.isAdditional`), and the two collector screens.
- **"Additional" badge** on the store row (dashboard route preview +
  `Today's List`), shown only while the store is still `pending`.
- **Float-to-top**: `sortAdditionalFirst()` lifts additional pending stores
  above the rest so a mid-day addition surfaces in the 3-row dashboard preview
  and at the top of the full list, instead of being buried.

Because the column defaults to `0`, **the app behaves exactly as before until
web starts sending `is_additional = true`.**

---

## 👉 What WEB must do

> **Admin UI:** all of the below assumes an admin action exists to *"add a store
> to an already-published day list."* If that action isn't in the admin UI yet,
> **it must be built** — a button/flow that inserts (or re-targets) a
> `collection_visits` row for the collector's current day with `is_additional =
> true`. Everything else here (the column, the SMS, the ack) hangs off that
> action firing.

### 1. Add the flag column (unblocks the badge above)

```sql
ALTER TABLE collection_visits
  ADD COLUMN is_additional boolean NOT NULL DEFAULT false;
```

Set it `true` when the admin adds a store to a **day list that was already
published** (i.e. added after the collector could have first synced it), and
`false` for every normally-scheduled row. The mobile app reads this verbatim —
no other value or vocabulary is expected. (Mobile stores it as `0/1` locally;
a JSON boolean from PostgREST maps fine.)

### 2. Send the SMS fallback (BusyBee) — **web-owned**

The SMS is triggered **server-side** the moment the admin adds the additional
store — the mobile app is the *recipient's* device and cannot send it, and the
BusyBee API key must never live in the mobile bundle. So this belongs entirely
in the web/backend:

- On "add additional store" → save the row (`is_additional = true`) **and**
  fire a BusyBee SMS to the collector's number, e.g.
  *"Additional store to collect: {store}, {area}. Open the app to confirm when
  you have signal."*
- Track the SMS send/delivery result so the admin board can show it.
- Needs a server context to hold the key + make the outbound call (API route /
  serverless fn / Supabase Edge Function). **Confirm the web app has one.**
- Mobile owner has the BusyBee API details and will provide them when this is
  built on the web side.

### 3. Add the two acknowledgment columns + UPDATE RLS (unblocks Phase B)

Decision: acknowledgment is tracked as **two separate signals** (chosen over
"one or the other"):

```sql
ALTER TABLE collection_visits
  ADD COLUMN additional_received_at timestamptz,  -- phone synced the row down
  ADD COLUMN additional_seen_at     timestamptz;  -- collector opened the store
```

- **`additional_received_at`** → dashboard "Delivered ✓": the row reached the
  collector's phone.
- **`additional_seen_at`** → dashboard "Viewed": the collector actually opened
  it.
- **RLS**: the assigned collector must be allowed to `UPDATE` *only* these two
  columns on their own visit rows. Mobile writes them through the existing
  offline outbox (same path as `collected` / `claimed_*`), so a plain
  authenticated UPDATE policy scoped to the collector is enough. Mobile writes
  each timestamp **once** and never overwrites.
- If it stays "Delivered" but not "Viewed", or stays Pending too long, the
  admin knows to phone the collector — the system stops pretending it arrived.

---

## ✅ Phase B — BUILT (mobile, 2026-08-08; web migrations 068/069)

The web side shipped the ack as **two collector-only RPCs** instead of a plain
UPDATE-RLS lane — `mark_additional_received(p_visit_id)` and
`mark_additional_seen(p_visit_id)`, both write-once (COALESCE) and idempotent. A
direct `.update()` on the three columns is **rejected by RLS on purpose**
(migration 069), so mobile must NOT route these through the normal outbox
(which does PostgREST upserts). Mobile wiring:

- **Columns mirrored** (`is_additional`, `additional_received_at`,
  `additional_seen_at`) into the local mirror — SQLite schema **v26** (added
  `additional_received_at`/`additional_seen_at` + a local-only
  `additional_seen_pending` intent flag), applier, mapper, `CollectionStore`.
- **RECEIVED** — a dedicated ack reconciler (`lib/sync/additional-acks.ts`) runs
  after every sync-down and calls `mark_additional_received` for any
  `is_additional` row with a null received-stamp. Self-healing: until the RPC
  lands the value stays null and the next online pass retries — no outbox row.
- **SEEN** — opening the store's visit screen sets the local
  `additional_seen_pending` flag (`markAdditionalSeen`, works offline); the same
  reconciler calls `mark_additional_seen` on the next online pass, then clears
  the flag.
- **Collector-gated** — the reconciler only fires for a signed-in `collector`
  (the RPCs raise 42501 otherwise).

Verify: mark a store additional on web → phone syncs (web shows **Delivered**)
→ open the store screen (web shows **Viewed**).

---

## Notes / decisions of record

- **Reconnect delivery is already solved** — don't rebuild it. `lib/use-sync.ts`
  already fires a full push+pull on every online transition, on post-login, and
  on a 30s foreground drain timer.
- **Ack semantics = both signals** (received-by-phone AND seen-by-collector),
  per the 2026-08-07 decision.
- Mobile schema is at **SQLite v24** after this change (was v23). The pulled
  cutoff migration had left `LATEST_SCHEMA_VERSION` at 22 while adding a v23
  block; bumping to 24 here also corrects that off-by-one.
- Scope is **collection only** for now. If delivery (COD `purchase_orders`) ever
  needs the same "additional PO" treatment, mirror this contract onto that table.
