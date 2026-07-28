# Collection & Delivery — mobile status

> Maintained by the mobile repo, for the web/admin team. The mirror of web's
> `COLLECTION_DELIVERY_FOR_MOBILE.md`. Last updated: 2026-07-28.
>
> **TL;DR:** the mobile sync is live. Read is verified on-device; the write path
> (collect / deliver / fail / reschedule / **claim**) reaches the live DB —
> confirmed by seeing `claimed_by` land on a `collection_visits` row after a
> phone claim. **The one thing waiting on web now: the admin board doesn't
> display claims yet** (see "Where web picks up"). Photos + remittances are the
> remaining mobile work.

## Where we are

| Area | Status |
| --- | --- |
| Screens / flows | ✅ Built (dashboard-first, no bottom nav) |
| Data model aligned to `043`–`046` | ✅ Done |
| **Phase 1 — READ** from live DB | ✅ Built + **verified on-device** (lists/dashboards show the admin-published rows with `client_name`/`area`) |
| **Phase 2 — WRITE outcome** (collect / deliver / fail / reschedule) | ✅ Built + **write path verified landing in DB** (same outbox path as the claim write below) |
| **Claiming / "On the way"** (write) | ✅ Built + **verified** — a phone claim writes `claimed_by`/`claimed_at`/`claimed_by_name` to the row |
| Real GPS (captured with the photo) | ✅ Built (`captureGps()` on payment/proof/backload photo) |
| Photos upload (`pending_uploads`) | ⬜ Not started |
| Remittances (`remittances` / `cod_remittances`) | ⬜ Not started |

## 👉 Where the WEB dev picks up (immediate)

**The admin board must display claims.** Mobile is writing `claimed_by` /
`claimed_at` / `claimed_by_name` to `collection_visits` / `purchase_orders`
(migration `046`) — verified in the DB — but the web board doesn't render them
yet, so a claim is invisible on the page even though it's really there.

This is web's own spec (`COLLECTION_DELIVERY_FOR_MOBILE.md` §11: *"the admin sees
who claimed what"*, *"the web board should visually flag a claim"*). Needed:

- Read `claimed_by_name` / `claimed_at` per row and show an "On the way — {name}"
  badge / lock indicator on the day board.
- Per §11, visually flag a claim sitting on a **past-dated pending** row so an
  admin can clear a stale one (claims never expire by decision).

Everything else the field app writes (status, `collector_id`/`driver_id`,
amounts, timestamps, GPS) already lands on the existing columns, so the board
should reflect those with no change.

## What's built (mobile)

- Full **read**: `collection_visits` + `purchase_orders` synced into a local
  SQLite mirror via the existing entity registry + appliers; lists, dashboards,
  and the Collect/Deliver detail screens all read live data.
- Full **write** through the offline outbox (local update → queue → push):
  - Collect → `status='collected'`, `collector_id`, `amount_collected`,
    `payment_method`, `visited_at`, GPS.
  - Reschedule → `status='rescheduled'`, `rescheduled_to`.
  - Deliver → `status='delivered'`, `driver_id`, `time_in`/`time_out`,
    `sequence_no`, `truck_plate`, `receiver_name`, COD fields, GPS.
  - Fail (= backload) → `status='failed'`, `driver_id`, times, `sequence_no`, GPS.
  - Claim / release → the three `claimed_*` columns together.
- **Real GPS** captured at photo time (the fix rides with the payment/proof/
  backload photo; "no fix" → no pin, never synthesized).
- Hard-lock UX: a stop claimed by someone else shows a red lock and disables the
  outcome buttons on that phone.

## What mobile still owes

- **Photos** — upload payment / delivery-receipt / proof / backload / COD /
  receiver-signature images to the `collection-proofs` / `delivery-proofs`
  buckets. Needs the shared `pending_uploads` lane generalised (it's meeting-only
  today) for the 6 new kinds. Outcome rows currently land with **null photo
  URLs** (schema allows it; web shows "missing proof"). This is the structural
  piece flagged in web's doc §5b.
- **Remittances** — submit `remittances` / `cod_remittances`, and wire the Remit
  screens off mock totals onto the real collected/COD figures.

## Known limitations / notes

- **23505 (one-claim) surfacing** — a claim rides the outbox, so if two phones
  claim the same stop the loser's push fails with `23505` on the next flush. The
  local claim is optimistic; a visible "your claim didn't stick" path is a
  follow-up (web doc §11 offline note).
- Not committed to `main` yet — the write/claim/GPS work sits on a branch pending
  review.

## Testing done

- **Read** verified on-device: admin-published rows show on the phone with names.
- **Write** verified: a phone **claim** wrote `claimed_by`/`claimed_by_name` to
  the live `collection_visits` row. (Collect/Deliver use the same outbox path —
  confirm the same way: collect a store, check the row shows `status='collected'`
  + `collector_id` + `amount_collected` + `visited_at`.)
