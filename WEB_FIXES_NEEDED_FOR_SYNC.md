# Web fixes for sync (Collection & Delivery) — ✅ DONE

> Updated by the web repo (Dev2/Adrian) on **2026-07-28**, replying to the
> version of this file mobile wrote. Original ask is preserved at the bottom.
>
> **Nothing on the web side is blocking mobile any more.** The customer-name
> problem is fixed, and the "On the way" claimed state you had as mock-only now
> has real schema behind it. Full detail lives in the web repo's
> `COLLECTION_DELIVERY_FOR_MOBILE.md` §4a and §11.

## What web shipped

Two migrations. Both auto-deploy to the shared Supabase project on merge to
main via `.github/workflows/deploy-migrations.yml` — no hand-running in the SQL
Editor.

### `045_denormalize_client_on_lists.sql` — the blocker you filed

Your diagnosis was exactly right, including the cause. Migration 031 dropped the
broad `"Authenticated read clients"` policy and 030's replacements cover agents,
managers, executives and tag-along participants — not `collector` or `delivery`.

| Table | New columns | Filled from, at publish time |
| --- | --- | --- |
| `collection_visits` | `client_name`, `area` | `clients.company_name`, `clients.city` |
| `purchase_orders` | `client_name` | `clients.company_name` |

`purchase_orders.area` already existed and is admin-entered — untouched. Rows
published before 045 are backfilled by the migration. The web admin forms now
write these on insert, so every newly published row carries them.

We went with denormalization rather than a new RLS policy on `clients` on
purpose: field roles have no business reading the customer master — contacts,
assigned agent, lifecycle status — just to put a name on a stop.

**Caveat:** point-in-time copy, not a live mirror. A customer renamed later keeps
the old name on rows already published. That is correct for a trip ticket, which
should say what it said on the day it was worked.

### `046_claim_stops.sql` — the "On the way" state, now real

The business settled the rules on 2026-07-28:

| Question | Answer |
| --- | --- |
| Soft hint or hard lock? | **Hard lock** — a claimed stop cannot be worked by anyone else |
| How many claims per person? | **Exactly one** |
| Does a claim expire? | **No** |
| Who can cancel? | The claimer, and any admin |
| Does the admin see claims? | Yes, on the web day board |

Both tables gained `claimed_by`, `claimed_at`, `claimed_by_name`.

**Note what did NOT happen:** we did not relax
`collection_visits_pending_is_unworked`, and you should not expect it to move.
Your original note assumed we would. Using a separate `claimed_by` instead of
overloading `collector_id`/`driver_id` means the constraint never applied to
claims in the first place. `collector_id` still means *who worked it*;
`claimed_by` means *who is en route*.

## What mobile needs to do

### 1. Read the name off the row, not from a join

Stop trying to resolve `client_id` → `clients`. It will keep failing under RLS.
Read `client_name` (and `area`, on collection) straight off the list row.

### 2. Claiming — three columns, always together

To claim a `pending` row where `claimed_by IS NULL`, write all three:
`claimed_by` = self, `claimed_at` = now, `claimed_by_name` = your own full name.
A CHECK constraint rejects a partial claim.

**Why `claimed_by_name` exists** — this is the same trap as `client_name` and it
would have bitten identically: a collector can read only their **own** `profiles`
row (migration 003). There is no policy letting field roles read each other, so
`claimed_by` alone is unresolvable on the phone and a stop held by someone else
would show "taken by ?". If you only need *mine vs somebody else's*, compare
`claimed_by` to your own profile id and ignore the name.

### 3. Handle error 23505 — this is the important one

If two phones claim the same stop, the loser gets a Postgres unique violation
(**23505**) on `collection_visits_one_active_claim` /
`purchase_orders_one_active_claim`. Do not retry blindly. It means one of two
things, and they need different messages:

- **Someone beat you to this stop.** Refresh the list; it is now locked to them.
- **You already hold a different one.** This is the one-claim rule working:
  "Finish or release your current stop first."

The unique index is what makes the hard lock correct, which is also why **we did
not build realtime** — a race resolves properly even if the loser's list is
seconds stale. Realtime stays a later UX improvement, not a prerequisite. (There
is no realtime anywhere in the web repo today.)

### 4. Releasing, and completion

- **Release:** null all three columns. RLS permits the claimer; an admin can
  clear anyone's from the web board.
- **Completion needs no release.** Writing the outcome (`collected` /
  `delivered` / `failed`) drops the row out of the index and frees your slot
  automatically. Leave `claimed_by` populated — it is kept as history on purpose.

### 5. Offline caveat worth designing for

A claim is a normal row update, so it rides your existing outbox — but it can
therefore fail on flush, long after the tap, if someone else claimed the stop
while the phone was out of signal. That is inherent to a hard lock plus offline.
Worth a visible "your claim didn't stick" path rather than a silent revert.

### 6. Unchanged from your Phase 2 list

Still yours, unaffected by any of the above: sync entity registry + local SQLite
tables, generalising `pending_uploads` for the 6 photo kinds, wiring real GPS at
photo-capture time, and writing `collector_id`/`driver_id`, `visited_at`,
`time_in`/`time_out` on the outcome.

## One thing to know about the whole-day rule

Claims never expire, by decision. The reasoning is the whole-day rule — a stop is
worked, rescheduled or failed on its own day, so a claim cannot outlive its day.

In practice nothing enforces that: there is no scheduled job anywhere in the
migrations that closes out a day. A stop claimed at 4pm and never worked stays
`pending` with the claim on it, and because each person holds only one claim,
that collector is blocked the next morning until an admin clears it. The web
board flags claims left on past-dated rows so the admin sees them. Mobile doesn't
need to do anything here — just don't be surprised by a claim that survived the
night, and surface a clear message if a claim attempt is refused for that reason.

## Verification, once both repos are up

Admin publishes a list on web → collector/driver phone reads it **with the
customer name showing** → phone claims a stop → a second phone sees it locked and
cannot take it → first phone works it down → it shows back on the web board with
the claim recorded.

---

<details>
<summary>Original ask from mobile, kept for the record</summary>

Mobile's version of this file said: `collection_visits` and `purchase_orders`
store only `client_id`; after migrations `030`/`031` the `collector` and
`delivery` roles have no RLS read on `clients`, so the app cannot resolve
`client_id` → name and every list row would show a blank customer. The fix asked
for was to denormalize the customer name onto the list rows, with the SQL and the
two admin-form insert sites spelled out.

It also listed the claimed / en-route state as "optional / later", noting mobile
shows an "On the way" indicator that was mock-only, and flagged the open
questions (soft hint vs lock; does a claim auto-expire). Both are now resolved
above.

</details>
