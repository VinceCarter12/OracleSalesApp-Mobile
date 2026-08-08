# Partial Payment — cross-repo contract

> Maintained by the **mobile** repo (`OracleSalesApp-Mobile`) for the **web/admin**
> repo (`OracleSalesApp-Web`). Companion to `COLLECTION_DELIVERY_STATUS_MOBILE.md`
> and `ADDITIONAL_COLLECTION_CONTRACT.md`. Created: 2026-08-08.
>
> **TL;DR:** a customer can pay only PART of what's due (₱1,000 of a ₱3,000
> collection). The store must **stay open with the remaining balance** and keep
> appearing on the list until it's fully paid — the shortfall must not vanish.

## The decision (owner, 2026-08-08)

Model chosen: **same visit stays open, balance carries down.**

- The visit is **not** closed on a partial payment. It becomes `status = 'partial'`.
- Each payment **draws down** the amount owed; the remaining balance is what
  shows on the list ("bawas lang sa naka-assign na amount").
- The store **re-appears every list** until the running total reaches the due,
  at which point it flips to `collected`.

Rejected alternatives: closing the visit + admin creating a new follow-up row;
collector-note-only with manual admin re-listing.

## Why this is blocked on WEB

1. **No partial/balance concept exists.** `collection_visits.status` is only
   `pending | collected | rescheduled`, and `amount_due` is a single per-visit
   snapshot — there is no running balance and no `partial` state.
2. **Proof-per-payment.** Every cash handover already requires a photo + customer
   signature. Two partial payments = two proofs. The current single
   `amount_collected` / `payment_photo_url` / `visited_at` columns hold ONE
   outcome, so a second payment would overwrite the first's proof.
3. Mobile writing `status='partial'` / a balance to columns that don't exist yet
   throws a PostgREST error on push (same failure class as the cutoff CHECK bug).

So mobile will not build the partial WRITE until the web schema below is live.

---

## 👉 What WEB must add

### 1. `'partial'` status

Extend the collection status enum with `partial`:

```sql
ALTER TYPE collection_status ADD VALUE IF NOT EXISTS 'partial';
```

`amount_due` stays the **original assigned total** (admin's number, never mutated
by the collector — so the record of what was owed is preserved).

### 2. A payments child table (one row per cash handover)

Each partial payment is its own proof-bearing row; the visit's collected total is
their sum. This keeps every payment's photo/signature/GPS/timestamp.

```sql
CREATE TABLE collection_payments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id        uuid NOT NULL REFERENCES collection_visits(id),
  collector_id    uuid NOT NULL,          -- profiles.id
  amount          numeric NOT NULL CHECK (amount > 0),
  payment_method  text NOT NULL,          -- cash | check | gcash | counter | delivery_receipt
  payment_photo_url            text,
  delivery_receipt_photo_url   text,
  gps_lat numeric, gps_lng numeric,
  remarks text,
  paid_at    timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3. Roll-up trigger on the visit

On each `collection_payments` insert, recompute the parent visit:

- `amount_collected = SUM(collection_payments.amount WHERE visit_id = …)`
- `status`:
  - `SUM >= amount_due` → `'collected'` (set `visited_at` to the last `paid_at`)
  - `0 < SUM < amount_due` → `'partial'`
- Remaining balance = `amount_due - amount_collected` (computed, not stored).

### 4. RLS

- Collector may **INSERT** a `collection_payments` row for a visit that is on
  their list (same scope that lets them collect today), and **SELECT** their own.
- Collector may **not** UPDATE `amount_due` (admin-owned) — they only add payments.
- The trigger runs `SECURITY DEFINER` so the status/collected roll-up isn't
  blocked by the collector's narrower column permissions.

### 5. Sync-down

Include `status='partial'` rows in the collector's day-list pull (they're still
open), and expose `amount_collected` so the phone can show the balance. If the
payments themselves need to sync down, add `collection_payments` to the pull;
otherwise the rolled-up `amount_collected` on the visit is enough for display.

---

## ✅ What MOBILE built (2026-08-09, web 070 deployed & tested)

**Phase A — display:**
- `'partial'` added to the status domain (`RemoteCollectionStatus` +
  `CollectionStoreStatus` + mapper); `remainingBalance()` / `isOpenForCollection()`
  helpers; `getCollectionSummary` counts partial as still-to-collect and folds
  partial cash into the collected total.
- **"Partial"** badge + **remaining balance** on the dashboard route preview,
  Today's List, and the Collect screen ("Balance still due" + "Already paid X of Y").
- A `partial` store stays on the list and is openable for the next installment.

**Phase B — write:**
- The collect flow now **INSERTs a `collection_payments` row** (full or partial)
  instead of updating the visit. Because collector RLS is INSERT-only, the write
  goes through a dedicated **offline queue + processor** (`lib/sync/collection-
  payments.ts`, run from the sync pass before sync-down): it **uploads the proof
  photos first, then inserts the payment with their URLs**. Idempotent on the
  client UUID (duplicate PK = already landed); own retry/backoff.
- Local SQLite gains a `collection_payments` queue table (schema **v27**). No
  entity-registry/outbox changes — it's a standalone lane like `pending_uploads`.
- The Collect screen soft-caps the amount at the remaining balance (over-payment
  is warned, not blocked — matches the "allow overpayment" decision). counter /
  delivery-receipt settle the **whole** balance (the `amount > 0` CHECK forbids 0).
- Optimistic local roll-up mirrors the server trigger so the collector sees the
  reduced balance + Partial/Collected immediately (offline too); sync-down then
  refreshes with the authoritative totals.
- A partial payment returns to the list (reduced balance); a full one flips to
  `collected` and shows the celebration screen.

## Open questions for the owner

- **Same-day vs next-day:** after a partial, should the store still be reachable
  **the same day** (customer pays more later that day), or only re-appear on the
  **next** published list? (Affects whether a `partial` row stays on *today's*
  list or moves to the archive.)
- **Overpayment on the last installment** — cap at the balance, or allow (ties to
  the soft over-payment warning already added)?
