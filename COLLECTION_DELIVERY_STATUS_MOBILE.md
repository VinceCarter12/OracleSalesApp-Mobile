# Collection & Delivery — mobile status

> Maintained by the mobile repo, for the web/admin team. The mirror of web's
> `COLLECTION_DELIVERY_FOR_MOBILE.md`. Last updated: 2026-07-28.
>
> **TL;DR:** screens are built and aligned to web's `043`/`044` model, still on
> mock data. Wiring to the live DB is **Phase 1 (read), currently BLOCKED** on one
> web change — see `WEB_FIXES_NEEDED_FOR_SYNC.md`.

## Where we are

| Area | Status |
| --- | --- |
| Screens / flows | ✅ Built (dashboard-first, no bottom nav) |
| Data model aligned to `043`/`044` | ✅ Done (mock, but correct shapes) |
| Phase 1 — READ from live DB | ⏸️ **Blocked** (customer name — see below) |
| Phase 2 — WRITE / photos / GPS | ⬜ Not started |

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

## ⏸️ Blocked on web (Phase 1 read)

Mobile can't display the customer name: `collection_visits`/`purchase_orders`
carry only `client_id`, and `collector`/`delivery` roles have no RLS read on
`clients` (post `030`/`031`). **Fix = denormalize `client_name` (+ `area` for
collection) onto the rows.** Full recipe (SQL + admin-form edits) in
**`WEB_FIXES_NEEDED_FOR_SYNC.md`**. Phase 1 resumes the moment those columns exist.

## What mobile still owes (Phase 2, after read works)

- Add `collection_visits` + `purchase_orders` to the sync entity registry + local
  SQLite tables + appliers (`clients` dependency for the outbox push).
- Generalise `pending_uploads` to carry the 6 new photo kinds (payment, delivery
  receipt, proof, backload, cod, receiver signature).
- Wire real GPS (`captureGps()`) onto the row at photo-capture time (a `MOCK_GPS`
  marker sits at the swap point in `visit.tsx` / `deliver.tsx`).
- Write `collector_id`/`driver_id`, `visited_at`, `time_in`/`time_out` on the
  outcome; submit `remittances` / `cod_remittances`.

## Mock-only (not wired to any table)

- **"On the way" / claimed-en-route indicator** on Today's List & PO List — needs
  a web schema change to become real (see the "Optional / later" section of
  `WEB_FIXES_NEEDED_FOR_SYNC.md`).

## Testing

Mobile is tested on-device against the live DB. First real end-to-end check:
admin publishes a list on web → collector/driver phone reads it → works one stop
down → it shows back on the web board.
