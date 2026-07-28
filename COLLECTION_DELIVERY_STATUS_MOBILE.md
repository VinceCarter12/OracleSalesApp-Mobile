# Collection & Delivery — mobile status

> Maintained by the mobile repo, for the web/admin team. The mirror of web's
> `COLLECTION_DELIVERY_FOR_MOBILE.md`. Last updated: 2026-07-28.
>
> **TL;DR:** screens are built and aligned to web's `043`/`044` model, still on
> mock data. Phase 1 (read) was blocked on one web change; **web shipped it on
> 2026-07-28 (migration 045) and Phase 1 is UNBLOCKED.** Web also shipped `046`,
> which gives the "On the way" indicator real schema. Integration checklist in
> `WEB_FIXES_NEEDED_FOR_SYNC.md`.

## Where we are

| Area | Status |
| --- | --- |
| Screens / flows | ✅ Built (dashboard-first, no bottom nav) |
| Data model aligned to `043`/`044` | ✅ Done (mock, but correct shapes) |
| Phase 1 — READ from live DB | ✅ **Unblocked** 2026-07-28 (web migration 045) — not yet wired |
| Phase 2 — WRITE / photos / GPS | ⬜ Not started |
| Claiming / "On the way" | ✅ Schema exists (web migration 046) — mobile not yet wired |

## What's built (mobile)

- **Collection:** dashboard, Today's List, Collect Payment (`visit`), Remit, History, Account, celebrate.
- **Delivery:** dashboard, PO List, Deliver PO (`deliver`), Remit COD, History, Account, celebrate.
- Navigation is **dashboard-first, no bottom tab bar** (Actions grid is the nav).

## Data model — aligned to web `043`/`044` (still mock)

Adopted all of the authoritative model:
- Delivery status `pending | delivered | failed` (failed = backload, one outcome, no follow-up window / `day`).
- Delivery **has GPS** (captured with the proof photo); no PO line-items.
- Lowercase payment methods incl. `counter` (collection); COD methods `cash|check|gcash`.
- Real ISO timestamps (`visited_at` / `time_in` / `time_out`); UUID string ids; `rescheduled`.

## ✅ Was blocked on web — resolved 2026-07-28

Mobile couldn't display the customer name: `collection_visits`/`purchase_orders`
carried only `client_id`, and `collector`/`delivery` roles have no RLS read on
`clients` (post `030`/`031`). Web shipped **migration 045**, which denormalizes
`client_name` (+ `area` for collection) onto the rows and backfills existing
ones. Read the name straight off the list row — don't join to `clients`, that
will keep failing under RLS.

Phase 1 can start. Integration checklist in **`WEB_FIXES_NEEDED_FOR_SYNC.md`**.

## What mobile still owes (Phase 2, after read works)

- Add `collection_visits` + `purchase_orders` to the sync entity registry + local
  SQLite tables + appliers (`clients` dependency for the outbox push).
- Generalise `pending_uploads` to carry the 6 new photo kinds (payment, delivery
  receipt, proof, backload, cod, receiver signature).
- Wire real GPS (`captureGps()`) onto the row at photo-capture time (a `MOCK_GPS`
  marker sits at the swap point in `visit.tsx` / `deliver.tsx`).
- Write `collector_id`/`driver_id`, `visited_at`, `time_in`/`time_out` on the
  outcome; submit `remittances` / `cod_remittances`.

## "On the way" indicator — schema now exists (web migration 046)

No longer mock-only on the web side. The rules the business settled: **hard
lock** (a claimed stop can't be worked by anyone else), **exactly one claim per
collector/driver**, **never expires**, cancellable by the claimer or an admin.

Mobile's side of it, in short — full detail in `WEB_FIXES_NEEDED_FOR_SYNC.md`:

- Claim by writing `claimed_by` / `claimed_at` / `claimed_by_name` together (a
  CHECK rejects a partial claim). The name is denormalized for the same reason
  as `client_name`: a collector can read only their own `profiles` row.
- **Handle Postgres 23505** on the one-active-claim index. It means either
  someone beat you to the stop, or you already hold a different one — two
  different messages.
- Completion needs no release; the outcome frees your slot automatically.

## Testing

Mobile is tested on-device against the live DB. First real end-to-end check:
admin publishes a list on web → collector/driver phone reads it → works one stop
down → it shows back on the web board.
