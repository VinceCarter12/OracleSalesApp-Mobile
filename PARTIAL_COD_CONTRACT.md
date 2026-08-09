# Partial COD Payment (Delivery) — cross-repo contract

> Maintained by the **mobile** repo (`OracleSalesApp-Mobile`) for the **web/admin**
> repo (`OracleSalesApp-Web`). Companion to `PARTIAL_COLLECTION_CONTRACT.md`,
> `COLLECTION_DELIVERY_STATUS_MOBILE.md` and `WEB_FIXES_NEEDED_FOR_SYNC.md`.
> Created: 2026-08-09.
>
> **TL;DR:** a COD customer can pay only PART of the COD due (₱4,000 of a ₱10,000
> COD). The PO must **stay open with the remaining COD balance** and keep
> appearing until it's fully paid — the shortfall must not vanish. Same model the
> owner chose for partial **collection** (2026-08-09 decision), now for delivery
> COD.

## The decision (owner, 2026-08-09)

Model chosen: **same PO stays open, COD balance carries down** — mirror of the
partial-collection model.

- The PO is **not** closed on a partial COD payment. It becomes `status = 'partial'`.
- Each COD payment **draws down** the amount owed; the remaining balance
  (`cod_due − cod_amount`) is what shows on the list.
- The PO **re-appears** until the running total reaches `cod_due`, at which point
  it flips to `delivered`.

## Delivery-specific nuance web must resolve (does NOT exist for collection)

A collection *is* the payment. A delivery is not: `delivered` normally requires
the **physical handover** (truck plate + proof-of-delivery photo + optional
receiver signature) AND the COD. So partial COD has a wrinkle collection doesn't:

- The **goods are handed over once** (first visit). A `partial` PO re-appears for
  **COD top-up only**, not re-delivery — the plate / proof-of-delivery photo /
  receiver are captured on the FIRST payment and not re-asked on later ones.
- So the roll-up must not require re-delivery on the 2nd+ COD payment, and
  `status='delivered'` should mean "handed over AND COD fully paid".

👉 **Open question for web/owner:** should a fully-handed-over-but-COD-short PO be
`status='partial'` (as chosen here), or `delivered` + a separate `cod_settled`
flag? The mobile build below assumes **`partial`** (parity with collection).

## Why this is blocked on WEB

`purchase_orders` today has a single `cod_amount` / `cod_due` and the status enum
is strictly `pending | delivered | failed` (`RemotePurchaseOrderStatus`,
`types/database.ts`). There is **no** partial/balance concept and **no** COD
payments child table — exactly the gap partial collection had before web 070.
Mobile writing `status='partial'` or a balance to columns that don't exist throws
a PostgREST error on push (same failure class as the cutoff CHECK bug), so mobile
will not build the partial COD **write** until the web schema below is live.

---

## 👉 What WEB must add (mirror of web 070 for `collection_payments`)

### 1. `'partial'` PO status

```sql
ALTER TYPE purchase_order_status ADD VALUE IF NOT EXISTS 'partial';
```

`cod_due` stays the **original assigned COD total** (never mutated by the driver).

### 2. A `cod_payments` child table (one row per COD handover)

```sql
CREATE TABLE cod_payments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id           uuid NOT NULL REFERENCES purchase_orders(id),
  driver_id       uuid NOT NULL,          -- profiles.id
  amount          numeric NOT NULL CHECK (amount > 0),
  payment_method  text NOT NULL,          -- cash | check | gcash
  payment_photo_url text,
  gps_lat numeric, gps_lng numeric,
  remarks text,
  paid_at    timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3. Roll-up trigger on the PO

On each `cod_payments` insert (SECURITY DEFINER), recompute the parent PO:

- `cod_amount = SUM(cod_payments.amount WHERE po_id = …)`
- `status`:
  - `SUM >= cod_due` AND the PO has been handed over → `'delivered'`
  - `0 < SUM < cod_due` → `'partial'`
- Do **not** re-require the delivery proof on a top-up payment (see nuance above).
- Remaining balance = `cod_due − cod_amount` (computed, not stored).

### 4. RLS

- Driver may **INSERT** a `cod_payments` row for a PO on their run, and **SELECT**
  their own. No UPDATE of `cod_due` (admin-owned).
- Trigger runs `SECURITY DEFINER` so the roll-up isn't blocked by the driver's
  narrower column permissions.

### 5. Sync-down

Include `status='partial'` POs in the driver's day-list pull (still open) and
expose `cod_amount` so the phone can show the balance.

---

## What MOBILE shipped now (2026-08-09, interim — no schema needed)

Delivery COD payment step reached **parity with the Collection screen's amount UX**:

- **Amount due (COD)** surfaced in a card right above the "Amount collected" input.
- Red **required-field validation** across the deliver form (truck plate, proof
  photo, COD payment photo, COD amount) — fields light up red on blur / on a
  submit attempt, matching Collection.
- Soft **over-payment warning** (amount above `cod_due` is allowed, just flagged);
  green "recorded" confirmation otherwise.

**Interim gap (until web ships §1–§5):** a COD amount *below* `cod_due` currently
completes the PO as `delivered` recording that partial `cod_amount` — the shortfall
is **not** yet tracked as an open balance. True "stays open with carried balance"
is the web-first build below.

## What MOBILE will build after web ships (mirror of collection Phase A + B)

- **Phase A — display:** `'partial'` in `DeliveryPoStatus`; a "Partial" badge +
  remaining COD balance on the dashboard/PO list/Deliver screen; partial POs stay
  on the list and are openable for the next COD installment.
- **Phase B — write:** the COD step INSERTs a `cod_payments` row (full or partial)
  instead of writing `cod_amount` directly — through a dedicated offline
  queue + processor (upload photo → insert with URL), idempotent on the client
  UUID, exactly like `lib/sync/collection-payments.ts`. Optimistic local roll-up
  mirrors the server trigger.

## Open questions for the owner

- **Same-day vs next-run:** after a partial COD, is the PO reachable the same run,
  or only re-appears on the next published delivery list?
- **`partial` vs `delivered + cod_settled`** — the delivery-nuance question above.
- **Who collects the COD top-up** — the same driver only, or any driver on that
  customer's next run?
