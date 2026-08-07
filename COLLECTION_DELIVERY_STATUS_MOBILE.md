# Collection & Delivery — mobile status

> Maintained by the mobile repo, for the web/admin team. The mirror of web's
> `COLLECTION_DELIVERY_FOR_MOBILE.md`. Last updated: 2026-07-28.
>
> **TL;DR:** the mobile sync is live. Read is verified on-device; the write path
> (collect / deliver / fail / reschedule / **claim**) reaches the live DB —
> confirmed by seeing `claimed_by` land on a `collection_visits` row after a
> phone claim. **Proof photos now upload** (Phase 2b, 2026-07-29): all 5 camera
> captures ride a generalized `pending_uploads` lane and patch their row's photo
> column. **The one thing waiting on web now: the admin board doesn't display
> claims yet** (see "Where web picks up"). Remittances are the remaining mobile
> work (+ the in-memory receiver signature, which needs an image-export step).

## Where we are

| Area | Status |
| --- | --- |
| Screens / flows | ✅ Built (dashboard-first, no bottom nav) |
| Data model aligned to `043`–`046` | ✅ Done |
| **Phase 1 — READ** from live DB | ✅ Built + **verified on-device** (lists/dashboards show the admin-published rows with `client_name`/`area`) |
| **Phase 2 — WRITE outcome** (collect / deliver / fail / reschedule) | ✅ Built + **write path verified landing in DB** (same outbox path as the claim write below) |
| **Claiming / "On the way"** (write) | ✅ Built + **verified** — a phone claim writes `claimed_by`/`claimed_at`/`claimed_by_name` to the row |
| Real GPS (captured with the photo) | ✅ Built (`captureGps()` on payment/proof/backload photo) |
| Photos upload (`pending_uploads`) | ✅ Built — payment, delivery-receipt, proof, COD, backload upload to `collection-proofs`/`delivery-proofs` and patch the row's `*_url` column. |
| Receiver signature (delivery) | ✅ Built — the signature pad renders to a JPEG and rides the deferred lane to `purchase_orders.receiver_signature_url`. |
| Remittances (`remittances` / `cod_remittances`) | ✅ Built — collection remit (office/bayad_center/bank_deposit) + COD remit (office). Uploads signed-proof/signature, INSERTs the row (online-only: no UPDATE RLS policy, so URLs go in the insert), and flags covered POs `cod_remitted`. Real "on hand" totals computed from synced local rows, excluding already-remitted. |

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

- Nothing structural on the field-app write side — collect, deliver, fail,
  claim, all photos, both remittances, and signatures now reach the live DB.
  Remaining items are polish: a "your claim didn't stick" (23505) surface, and a
  remittance history view.

## 👉 Where the WEB dev picks up (Additional Collection — 2026-08-07)

New feature: the admin can add a store to an **already-published** day list
("this store wasn't for collection today, but now it is"). Mobile models it as
an **Additional** store (badged + floated to the top). The mobile half (Phase A)
is built; web owns a flag column, the BusyBee **SMS fallback**, and two
acknowledgment columns. **Full contract: see `ADDITIONAL_COLLECTION_CONTRACT.md`.**

## 👉 Where the WEB dev picks up (remittances)

- The admin board should show submitted `remittances` / `cod_remittances` and
  reconcile them (the `status` column supports `submitted`→`reconciled`/
  `variance`). Mobile submits with `status='submitted'` and never updates them
  after (there's no field-role UPDATE policy, by design).

## ✅ Done since last update (Phase 2c — signatures + remittances, 2026-07-29)

- **SignaturePad** now renders the drawn strokes to a JPEG (`Svg.toDataURL` →
  PNG → transcode), exposed via an imperative `captureToFile()` the screens call
  at submit. Fixed white bg + dark ink so it's clean in both themes.
- **Remittances** are a full sync entity now: local mirror tables (SQLite v19),
  appliers, registry entries (own-rows pull by collector_id/driver_id), and
  remote-upsert insert cases. Write is online-only (upload photos → INSERT via
  outbox) because the remittance tables have INSERT+SELECT RLS but no UPDATE, so
  photo URLs must be in the insert, not patched later (same shape as PO
  confirmation). Verified column/RLS facts against migrations 043/044:
  `remittances.destination` ∈ office|bayad_center|bank_deposit; `cod_remittances`
  is office-only with no signed_proof_url and a NOT NULL receiver_name.

## ✅ Done earlier (Phase 2b — photos + GPS, 2026-07-29)

- **Photos upload** — the meeting-only `pending_uploads` lane was generalized to
  a cross-entity queue: each row now carries `parent_table` + `parent_id` (SQLite
  v18) and a kind→{bucket, column} registry (`lib/sync/photo-upload-registry.ts`).
  Collect/Deliver/Fail queue their captures right after the outcome's outbox row;
  a dependency guard holds each upload until the outcome row has synced, then the
  public URL patches the row's `*_url` column via the parent's existing outbox
  lane. Column names verified against migrations 043/044 (note: `proof_url`, and
  `cod_photo_url` is on `purchase_orders` — the §5b summary was wrong).

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
