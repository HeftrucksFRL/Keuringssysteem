-- Installeer na workshop-module.sql, VOORDAT je een tabletaccount aanmaakt.
-- RLS blijft voor bestaande gebruikers gelijk; de extra beperking geldt uitsluitend
-- voor accounts met de door de admin ingestelde app_metadata.app_role=workshop_viewer.
begin;
do $$
declare target record;
begin
  -- Fail closed if an existing public table bypasses RLS. Enable/harden it deliberately
  -- first instead of guessing new access rules for Age or Renze.
  for target in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
  loop
    raise exception 'Tabel public.% heeft nog geen RLS. Richt eerst bestaande toegangsrechten in.', target.relname;
  end loop;
  -- Owner-executed views and definer RPCs can bypass table policies. Stop for review
  -- if those are exposed; never silently grant a tablet account access through them.
  for target in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('v','m') and has_table_privilege('authenticated',c.oid,'SELECT')
  loop
    raise exception 'Controleer eerst de toegang via view public.% voor tabletaccounts.',target.relname;
  end loop;
  for target in select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and has_function_privilege('authenticated',p.oid,'EXECUTE')
  loop
    raise exception 'Controleer eerst de toegang via security-definerfunctie public.% voor tabletaccounts.',target.proname;
  end loop;
  for target in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and c.relname <> 'workshop_planning'
  loop
    execute format('drop policy if exists workshop_tablet_isolation on public.%I',target.relname);
    execute format($policy$create policy workshop_tablet_isolation on public.%I as restrictive for all to authenticated
      using (coalesce(auth.jwt()->'app_metadata'->>'app_role','') <> 'workshop_viewer')
      with check (coalesce(auth.jwt()->'app_metadata'->>'app_role','') <> 'workshop_viewer')$policy$,target.relname);
  end loop;
end;
$$;
drop policy if exists workshop_tablet_isolation on storage.objects;
create policy workshop_tablet_isolation on storage.objects as restrictive for all to authenticated
  using (coalesce(auth.jwt()->'app_metadata'->>'app_role','') <> 'workshop_viewer')
  with check (coalesce(auth.jwt()->'app_metadata'->>'app_role','') <> 'workshop_viewer');
create table if not exists public.workshop_access_config(id integer primary key check(id=1),version integer not null);
alter table public.workshop_access_config enable row level security;
revoke all on public.workshop_access_config from anon,authenticated;
grant select,insert,update on public.workshop_access_config to service_role;
insert into public.workshop_access_config(id,version) values(1,1) on conflict(id) do update set version=excluded.version;
commit;
