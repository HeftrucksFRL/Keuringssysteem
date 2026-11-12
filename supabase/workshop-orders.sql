begin;
create table if not exists public.workshop_orders (
 id uuid primary key,
 details jsonb not null,
 status text not null default 'Nieuw' check(status in ('Nieuw','In behandeling','Besteld','Ontvangen','Afgewezen')),
 version integer not null default 0 check(version>=0),
 manager_note text not null default '', supplier text not null default '', reference text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.workshop_orders enable row level security;
revoke all on public.workshop_orders from anon,authenticated;
grant select,insert,update on public.workshop_orders to service_role;
-- All access goes through authenticated server endpoints. Tablet users can only
-- submit a new request; manager-only status changes are separately validated.
create index if not exists workshop_orders_status_created_idx on public.workshop_orders(status,created_at desc);
commit;
