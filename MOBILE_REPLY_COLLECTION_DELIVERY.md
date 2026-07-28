# Mobile → Web reply: Collection & Delivery contract

> From the mobile repo (Dev3/Dev4) on 2026-07-28, replying to
> `COLLECTION_DELIVERY_FOR_MOBILE.md` (web, Adrian, 2026-07-27).
>
> **Purpose:** confirm the table shapes so web can merge `043`/`044`, answer the
> open questions, and raise one new proposal (claimed / en-route state). Paste
> the relevant parts into web's §10 when merging.

---

## 1. Shapes confirmed — safe to merge `043` / `044`

We read `043_collection_module.sql` + `044_delivery_module.sql` and aligned the
mobile mock model (`lib/collection-delivery-data.ts`) + the Collect Payment /
Deliver PO screens to them. **No shape objections — please go ahead and merge.**

Specifically, mobile has adopted all of §4:

**Delivery (`purchase_orders`)**
- Status is `pending | delivered | failed` — dropped `followup` and `backload`.
  A failed delivery **is** a backload (backload photo is a capture on a failed
  row, not a status). The two-button "Failed attempt / Backload" UI is now one
  "Failed / Backload" outcome that requires the backload photo.
- Dropped the 3-day `day` counter and every countdown built on it.
- Dropped `items` — rows show customer + area only.
- **Delivery GPS is in** — the "no GPS" rule is removed from the screens; GPS is
  captured with the proof/backload photo ("no photo → no pin").
- `time` string → `time_in` / `time_out` (captured on failed stops too);
  `seq` → `sequence_no`; `receiver` → `receiver_name` + signature; added
  `truck_plate`; `id` → UUID string.

**Collection (`collection_visits`)**
- `PaymentMethod` is lowercase and includes `counter` → `cash|check|gcash|counter`.
- `resched` → `rescheduled`.
- `time` string → `visited_at` (timestamp) — understood this is the sole trip
  ordering signal.
- `collector_id` written at collection time, null while pending.
- Two photo columns (`payment_photo_url`, `delivery_receipt_photo_url`), both
  required by the UI before "✓ Collected".
- `amount_due` kept hidden on the Collect screen (anchoring bias); `id` → UUID.

## 2. Answers to your open questions (§10)

1. **Driver's app shows the COD amount?** — **Yes, agreed.** COD is a fixed price,
   not a negotiable balance; the Deliver screen shows `₱X due`.
2. **`pending_uploads`: generalise or parallel table?** — **Generalise.** We'll
   widen `owner_id` + `owner_type` + the `kind` CHECK to carry the six new photo
   kinds, reusing the one drain loop / retry policy.
3. **Collector/driver sees their own trail on the phone?** — Not needed for now;
   keep it admin-only. We'll ask if that changes.
4. **Trail retention** — no objection to 90 days.
5. **Trails for verification vs optimisation** — verification. (Route trails
   themselves are still a separate, unapproved decision — see §7 of your doc.)

## 3. NEW proposal — "claimed / en-route" state ⚠️ needs a web schema change

**Context:** field teams want to see that *someone is already on the way to a
stop* so two workers don't double-visit it. Mobile has added an "On the way"
indicator (amber badge + "Kinukuha na ni / Dinadala na ni {name}") on the
Today's List and PO List — **but it is MOCK-ONLY right now.**

**The conflict:** your current schema has no claimed/en-route state. A pending
row must have `collector_id` / `driver_id` **NULL**
(`collection_visits_pending_is_unworked` / `purchase_orders_pending_is_unrun`),
so a stop can't be "claimed but not yet collected." Claim and collect happen in
one step today.

**What would make it real (web-owned, your call):**
- A way to mark a pending row as claimed without closing it — e.g. a
  `claimed_by UUID` + `claimed_at TIMESTAMPTZ` pair, **or** an `in_progress`
  status between `pending` and the terminal states.
- Relax the `*_pending_is_unworked` / `*_is_unrun` constraint to allow a claimed
  pending row (claimed ⇒ worker id set, but no `visited_at`/`time_out` yet).
- An RLS UPDATE path so a field user can claim (set `claimed_by = me`) and
  release a claim, without being able to steal someone else's.
- Realtime (or a short poll) so other phones see the claim within a few seconds —
  otherwise the indicator is stale and two people still collide.

**Open questions for this feature:**
- Is a claim a soft hint (others can still go) or a soft lock (warned/blocked)?
- Does a claim expire on its own (e.g. after N hours, or at end of day) so a
  forgotten claim doesn't freeze a stop forever?

If you'd rather not build this now, that's fine — mobile keeps the indicator
mock-only and clearly commented; we just won't wire it to anything.

## 4. What mobile still owes before end-to-end (so you know the state)

Not blocking your merge — this is our side of the work, once the tables are live:
- Add `collection_visits` + `purchase_orders` to `ENTITY_REGISTRY` + local SQLite
  tables + appliers (with a `clients` dependency).
- Generalise `pending_uploads` (see §2.2).
- Wire real GPS (`captureGps()`) onto the business row at capture time — we left a
  `MOCK_GPS` marker at the swap point in `visit.tsx` / `deliver.tsx`.
- Write `collector_id` / `driver_id` and real `time_in` / `time_out` on sync.

**First real end-to-end test we're aiming for:** admin publishes a real list on
web → a collector's phone reads it (sync-down) → works one stop down → it shows
back on the web board.
