# Remittance ↔ Partial Payment — cross-repo contract

> Maintained by the **mobile** repo (`OracleSalesApp-Mobile`) for the **web/admin**
> repo (`OracleSalesApp-Web`). Companion to `PARTIAL_COLLECTION_CONTRACT.md`,
> `PARTIAL_COD_CONTRACT.md`, and `COLLECTION_DELIVERY_STATUS_MOBILE.md`.
> Created: 2026-08-10.
>
> **TL;DR:** remittance coverage is tracked **per visit / per PO** today
> (`remittances.visit_ids`, `cod_remittances.po_ids`). That is fundamentally
> incompatible with **partial** collection/COD, where one visit/PO accrues cash
> in **multiple installments over time**. The correct model is **per-payment**
> remittance coverage. This needs a web schema change; mobile ships an interim
> fix in the meantime.

---

## The bugs this addresses (found 2026-08-10)

Reported by the owner: *"I collected ₱900 (full) and ₱500 (partial, of a ₱700
due), but the remittance only recorded ₱900. Also, after remitting, the
dashboard still shows an amount 'for remittance'."*

### Bug 1 — dashboard "For remittance" never decreased  ✅ fixed on mobile
`getCollectionSummary().forRemittance` was hardcoded to `collectedTotal` (a
mock-era leftover) and was never remittance-aware. **Fix (mobile-only):** the
`(collection)` dashboard hero now reads the real cross-day on-hand from
`useCollectionOnHand` (collected + partial visits **not** covered by any
remittance) — the same number the Remit screen uses. No web change.

### Bug 2 — partial-collection cash was never remittable  ⚠️ interim fix on mobile
`useCollectionOnHand` filtered `status = 'collected'` only, so a `partial` visit
(cash already in the bag) was dropped from on-hand and from the remittance
`visit_ids` — the web recorded only the fully-paid visits' cash.

**Interim fix (mobile-only, shipped):** include `status = 'partial'` visits in
on-hand. This makes the immediate case correct (the ₱500 is now remitted with
the ₱900 → ₱1,400).

**Why it's only interim — the top-up stranding edge:** because remittance
coverage is per-visit (all-or-nothing on `visit_id`), once a partial visit is
remitted, its id is in a past remittance's `visit_ids`. When the customer later
pays the **remaining** installment (visit flips `partial → collected`), that
top-up cash is **stranded** — the visit is excluded from on-hand forever. The
only clean fix is per-payment coverage (below).

> ⚠️ **The delivery side has the identical latent bug** for **partial COD**
> (web 073): `cod_remittances.po_ids` + the `purchase_orders.cod_remitted`
> boolean are per-PO all-or-nothing. A partial COD PO that is remitted and then
> receives a further COD installment will strand that increment the same way.
> The web change below should cover **both** domains.

---

## 👉 What WEB must add (the correct, per-payment model)

The unit of remittance is a **payment**, not a visit/PO. A collector remits the
set of individual cash handovers they are holding; each handover is remitted
exactly once, regardless of which visit it belongs to.

### 1. Mark which payments a remittance covers

Preferred: a link column on the child payment rows, written when a remittance is
submitted.

```sql
-- Collection payments (web 070)
ALTER TABLE collection_payments
  ADD COLUMN remittance_id uuid NULL REFERENCES remittances(id);

-- COD payments (partial COD, web 073) — mirror the same shape
ALTER TABLE cod_payments
  ADD COLUMN cod_remittance_id uuid NULL REFERENCES cod_remittances(id);
```

(Equivalent alternative: a join table `remittance_payments(remittance_id,
payment_id)`. Either works; the link column is simpler for the phone to read.)

`remittances.visit_ids` / `cod_remittances.po_ids` may stay for display/back-compat,
but **coverage is now defined by the payment link**, not those arrays.

### 2. "Remitted amount" is derivable, not snapshotted
- A payment is **on hand** ⇔ `remittance_id IS NULL`.
- A remittance's `amount_remitted` = `SUM(amount)` of the payments it links.
- No new column on `collection_visits` is needed; the visit keeps rolling up
  `amount_collected` from **all** its payments as it does today.

### 3. RLS
- Collector may set `remittance_id` **only** on their own, currently-unremitted
  payments (`collector_id = auth.uid() AND remittance_id IS NULL`), and only to a
  remittance they own. Once set, it is immutable to the collector (no
  double-remit, no un-remit).
- Same for `cod_payments.cod_remittance_id` on the driver side.

### 4. Sync-down (the payment ledger)
Mobile currently has **no full payment ledger** — only the visit's rolled-up
`amount_collected` and its own outgoing `collection_payments` queue rows. To
compute per-payment on-hand, the phone needs to read every payment's
`{ id, visit_id, amount, payment_method, remittance_id }`:

- Add `collection_payments` (and `cod_payments`) to the **collector's / driver's
  sync-down pull**, scoped to their own rows.
- Expose `remittance_id` / `cod_remittance_id` so the phone can compute
  on-hand = `SUM(amount) WHERE remittance_id IS NULL`.

---

## ✅ What MOBILE built once web shipped the above — SHIPPED 2026-08-18

Web confirmed the per-payment schema is live: 070/073 grant "read own payments"
SELECT RLS, 086/087 added `remittance_id`/`cod_remittance_id` + the narrow
"link own payments to remittance" UPDATE RLS. Mobile then wired the full flow:

1. **Ledger sync-down.** `lib/sync/payment-ledger-sync-down.ts` pulls the
   collector's/driver's OWN `collection_payments`/`cod_payments`
   (`{id, visit_id/po_id, amount, payment_method, paid_at, created_at, link}`),
   upserting server rows while preserving the local outbox/link columns. Called
   best-effort from `syncDown()` after the remittances pulls.
2. **On-hand from the ledger.** `useCollectionOnHand`/`useCodOnHand`
   (`lib/use-remittance.ts`) now sum this agent's `status='synced'` payments
   where the link (and the staged `pending_*_remittance_id`) IS NULL, and return
   PAYMENT ids. The interim `status IN ('collected','partial')` visit scan and
   the per-PO `cod_remitted=0` scan are gone — top-up stranding is fixed.
3. **Submit links payments.** `submitCollectionRemittance`/`submitCodRemittance`
   (`lib/remittance-write.ts`) take `paymentIds`, still derive+write
   `visit_ids`/`po_ids` for back-compat, and STAGE `pending_*_remittance_id` on
   the covered rows.
4. **Link push lane.** `lib/sync/remittance-link.ts` pushes the staged link
   (`UPDATE …_payments SET …remittance_id`) once the parent remittance row is
   locally `sync_status='synced'` (FK ordering), with retry/backoff. Wired into
   the sync pass after `processOutbox` + the payment insert lanes, before
   `syncDown` — so a submit + its links + the web-side ack SMS settle in one pass.

### Local schema (mobile) — shipped
`ensureRemittanceLinkColumns()` in `lib/db.ts` adds, idempotently (like
`ensureSelfieProofColumns`, no `LATEST_SCHEMA_VERSION` bump), to
`collection_payments`: `remittance_id`, `pending_remittance_id`,
`link_retry_count`, `link_next_attempt_at`, `link_error`; and the
`cod_remittance_id`/`pending_cod_remittance_id`/`link_*` twins on `cod_payments`.
The existing insert-queue columns (`status`, photo uris) are untouched — the same
table now doubles as the synced-down ledger.

### Back-compat retained
`remittances.visit_ids` / `cod_remittances.po_ids` are still written (derived from
the covered payments), and `submitCodRemittance` still flags `purchase_orders.
cod_remitted` — mobile no longer reads it, but web paths keying off it keep working.

### Still WEB-owned
The customer-acknowledgement SMS fires server-side when the link column is set
(mobile just performs the UPDATE) — nothing further owed by mobile.
