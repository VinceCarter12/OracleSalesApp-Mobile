# Remit Receiver — cross-repo contract (mobile ↔ web)

**Date:** 2026-08-21 · **Status:** WEB-blocked (one small SQL function to add)

## What / why

On the mobile **Remit** screens (Collection and Delivery), the "Assigned receiver"
used to be two hardcoded names (Grace Villanueva / Bong Salazar). It should be the
**real admin account that manages that module** — the Collection admin for the
Collection remit, the Delivery admin for the Delivery remit.

Mobile can't do this from the field alone. Web migrations **030 + 031** (applied by
hand 2026-07-26) dropped the broad "Authenticated read profiles" policy; a
collector/driver now reads only **their own profile and same-team profiles**, so the
phone gets **zero** admin rows and the picker shows "No admin is assigned to receive
this module's remittance yet."

Fix: a `SECURITY DEFINER` RPC that returns just the module's admin account(s) to any
authenticated caller — exactly the pattern migration 030 used when it replaced broad
reads with scoped functions (e.g. the clients directory RPC). No table, no RLS change,
no column added.

## Who is a "receiver"

Mirrors web's existing `public.admin_manages_module(p_module)` (migration 043):
- a **superadmin**, or
- an **admin** whose `admin_scope` (migration 024) is `'all'` or exactly the module.

`admin_scope` defaults to `'all'`, so any active admin already qualifies for every
module — the "assign" step is just: in web **User management**, make sure the intended
person is an active Admin (or Superadmin) whose scope is `all`/`collection`/`delivery`.

## The migration to add (web repo `supabase/migrations/`, next number)

```sql
-- 1XX — Remit receiver read surface (mobile Remit "Assigned receiver")
--
-- Field roles lost broad profiles read in 030/031. This SECURITY DEFINER function
-- is the sanctioned, minimal read path for a module's admin account(s) — the office
-- remittance receiver. Returns only identity columns (no email/contact), for ACTIVE
-- admins that manage the module, most-relevant first. Idempotent.

create or replace function public.list_module_receivers(p_module text)
returns table (id uuid, full_name text, role text, admin_scope text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, coalesce(p.admin_scope, 'all')
  from public.profiles p
  where p_module in ('collection', 'delivery')   -- guard: anything else returns no rows
    and p.is_active = true
    and (
      p.role = 'superadmin'
      or (p.role = 'admin' and coalesce(p.admin_scope, 'all') in ('all', p_module))
    )
  order by
    case
      when p.role = 'admin' and coalesce(p.admin_scope, 'all') = p_module then 0
      when p.role = 'admin' and coalesce(p.admin_scope, 'all') = 'all'    then 1
      else 2  -- superadmin
    end,
    p.full_name;
$$;

grant execute on function public.list_module_receivers(text) to authenticated;
```

You can paste this straight into the Supabase **SQL Editor** (same way migration 031
was applied by hand), or add it as a numbered migration file and `supabase db push`.

## Verify

```sql
-- Should list your Collection admin(s):
select * from public.list_module_receivers('collection');
-- Should list your Delivery admin(s):
select * from public.list_module_receivers('delivery');
-- Guard: returns nothing
select * from public.list_module_receivers('sales');
```

If a module returns no rows, that module simply has no active admin whose scope
covers it — set one in web User management. On the phone, reopen the Remit screen
(or tap **Try again**) and the receiver(s) appear.

## Mobile side — already done (forward-compatible)

- `lib/use-remit-receivers.ts` calls `supabase.rpc('list_module_receivers', { p_module })`.
  Until the function exists it returns PGRST202, which the hook treats as "not
  configured yet" (the empty state), not an error.
- `types/database.ts` declares the function signature.
- `ReceiverPicker` renders loading / offline-error(+retry) / empty states.
- `RemitReceiver.id` is now the admin's profile UUID; the stored `receiver_name`
  on the remittance is the admin's real name.

No further mobile change is needed once the function ships.
