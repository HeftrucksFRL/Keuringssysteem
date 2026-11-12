-- Werkplaatsmodule v1. Voer eenmalig uit in de Supabase SQL-editor.
-- Opnieuw uitvoeren behoudt de bestaande planning.
create table if not exists public.workshop_planning (
  id integer primary key check (id = 1),
  version bigint not null default 0 check (version >= 0),
  state jsonb not null default '{"employees":[],"jobs":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.workshop_planning (id) values (1) on conflict (id) do nothing;
alter table public.workshop_planning enable row level security;
-- Alleen de server-API schrijft. RLS biedt ingelogde gebruikers leesrechten;
-- schrijfverzoeken lopen via servervalidatie en de service-role client.
revoke all on public.workshop_planning from anon, authenticated;
grant select on public.workshop_planning to authenticated;
grant select, update on public.workshop_planning to service_role;
drop policy if exists workshop_read on public.workshop_planning;
create policy workshop_read on public.workshop_planning for select to authenticated using (true);
