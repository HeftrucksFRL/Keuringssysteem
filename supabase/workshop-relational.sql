-- FRL werksysteem: atomische opslag, afzonderlijke bonnen en inzetbaarheid.
-- Installeer vóór de bijbehorende appversie. Opnieuw uitvoeren behoudt gegevens.
begin;
lock table public.workshop_planning in access exclusive mode;

create table if not exists public.workshop_meta (
  id integer primary key check(id=1), version bigint not null,
  data jsonb not null, updated_at timestamptz not null default now(), updated_by uuid
);
create table if not exists public.workshop_jobs (
  id text primary key, data jsonb not null, revision bigint not null default 1,
  number text generated always as (data->>'number') stored unique,
  machine_id text generated always as (data->>'machineId') stored,
  updated_at timestamptz not null default now(), updated_by uuid,
  check(data->>'id'=id)
);
create index if not exists workshop_jobs_machine on public.workshop_jobs(machine_id);
create table if not exists public.workshop_transports (
  id text primary key, data jsonb not null, revision bigint not null default 1,
  job_id text generated always as (nullif(data->>'jobId','')) stored unique references public.workshop_jobs(id),
  updated_at timestamptz not null default now(), updated_by uuid,
  check(data->>'id'=id)
);
-- Import exactly once. The original document remains as a restricted backup.
do $$ begin
  if not exists(select 1 from public.workshop_meta where id=1) then
    insert into public.workshop_meta(id,version,data)
      select 1,version,state-'jobs'-'transports' from public.workshop_planning where id=1;
    insert into public.workshop_jobs(id,data)
      select j->>'id',j from public.workshop_planning, jsonb_array_elements(state->'jobs') j where workshop_planning.id=1;
    insert into public.workshop_transports(id,data)
      select t->>'id',t from public.workshop_planning, jsonb_array_elements(coalesce(state->'transports','[]')) t where workshop_planning.id=1;
    insert into public.workshop_transports(id,data)
      select 'transport-'||j.id,jsonb_build_object('id','transport-'||j.id,'jobId',j.id,'kind','Werkbon',
        'title',j.data->>'number'||' · '||(j.data->>'machine'),'customer',j.data->>'customer','machine',j.data->>'machine',
        'pickup',coalesce(j.data->'transport'->>'pickup','Eigen werkplaats'),
        'address',coalesce(j.data->'transport'->>'address',j.data->>'deliveryAddress',''),
        'contact',coalesce(j.data->'transport'->>'contact',''),'instructions',coalesce(j.data->'transport'->>'instructions',''),
        'driver',coalesce(j.data->'transport'->>'driver',''),'date',coalesce(j.data->'transport'->>'date',''),
        'appointmentTime',coalesce(j.data->'transport'->>'time',''),'position',0,
        'state',coalesce(j.data->'transport'->>'state','Nieuw'),'confirmation',coalesce(j.data->'transport'->>'confirmation',''))
        || case when j.data->'transport' is not null and j.data->'transport'<>'null'::jsonb then '{"legacyReleased":true}'::jsonb else '{}'::jsonb end
      from public.workshop_jobs j where not exists(select 1 from public.workshop_transports t where t.job_id=j.id);
    update public.workshop_jobs set data=jsonb_set(data,'{transport}','null'::jsonb);
    update public.workshop_jobs set data=data||jsonb_build_object('status','Afgerond')||
      case when data->>'completedAt' is null and data->>'officeApprovedAt' is not null then jsonb_build_object('completedAt',data->>'officeApprovedAt') else '{}'::jsonb end
      where data->>'status'='Klaar voor transport';
  end if;
end $$;

alter table public.workshop_meta enable row level security;
alter table public.workshop_jobs enable row level security;
alter table public.workshop_transports enable row level security;
revoke all on public.workshop_meta,public.workshop_jobs,public.workshop_transports from public,anon,authenticated;
grant select,insert,update on public.workshop_meta,public.workshop_jobs,public.workshop_transports to service_role;
-- No client may keep writing the obsolete shared document after migration.
revoke all on public.workshop_planning from anon,authenticated;
revoke update on public.workshop_planning from service_role;

create or replace view public.workshop_state with (security_invoker=true) as
select m.id,m.version,m.updated_at,m.updated_by,
  m.data || jsonb_build_object(
    'jobs',coalesce((select jsonb_agg(j.data order by j.number) from public.workshop_jobs j),'[]'::jsonb),
    'transports',coalesce((select jsonb_agg(t.data order by t.id) from public.workshop_transports t),'[]'::jsonb)
  ) as state
from public.workshop_meta m;
revoke all on public.workshop_state from public,anon,authenticated;
grant select on public.workshop_state to service_role;

-- A planned open work order occupies its machine on that day. The rental's end
-- date remains a switch day; same-day rentals occupy that single day.
create or replace function public.workshop_rental_day(p_start date,p_end date,p_day date)
returns boolean language sql immutable set search_path=public as $$
  select p_day>=p_start and (p_day<p_end or (p_start=p_end and p_day=p_start))
$$;

create or replace function public.guard_rental_availability() returns trigger
language plpgsql set search_path=public as $$
declare machine public.machines%rowtype;
begin
  -- Shared transaction lock orders rental and workshop decisions. It is brief;
  -- unrelated stale forms are merged per record, not rejected by this lock.
  perform pg_advisory_xact_lock(72190411);
  if new.end_date<new.start_date then raise exception 'De einddatum mag niet vóór de startdatum liggen.'; end if;
  if new.status='completed' then return new; end if;
  select * into machine from public.machines where id=new.machine_id for update;
  if machine.id is null then raise exception 'Machine niet gevonden.'; end if;
  if machine.availability_status='maintenance' or coalesce(machine.configuration->>'__archivedAt','')<>'' then
    raise exception 'Deze machine staat in onderhoud of archief en is niet verhuurbaar.';
  end if;
  if not exists(select 1 from public.customers c where c.id=machine.customer_id
    and trim(regexp_replace(lower(c.company_name),'[^a-z0-9]+',' ','g')) in
    ('heftrucks frl','heftrucks friesland','heftrucks friesland b v','heftrucks friesland bv','terpstra trading','terpstra trading b v','terpstra trading bv')) then
    raise exception 'Alleen eigen voorraadmachines zijn verhuurbaar. De eigenaar is mogelijk gewijzigd.';
  end if;
  if exists(select 1 from public.rentals r where r.machine_id=new.machine_id and r.id<>new.id and r.status='active'
    and ((new.start_date<r.end_date and new.end_date>r.start_date)
      or public.workshop_rental_day(r.start_date,r.end_date,new.start_date) and new.start_date=new.end_date
      or public.workshop_rental_day(new.start_date,new.end_date,r.start_date) and r.start_date=r.end_date)) then
    raise exception 'Deze machine is in die periode al verhuurd.';
  end if;
  if exists(select 1 from public.workshop_jobs j where j.machine_id=new.machine_id::text
    and j.data->>'status' not in ('Afgerond','Klaar voor transport','Geannuleerd')
    and nullif(j.data->>'date','') is not null
    and public.workshop_rental_day(new.start_date,new.end_date,(j.data->>'date')::date)) then
    raise exception 'Deze machine heeft werkplaatswerk in de gekozen verhuurperiode. Rond dat af of verplaats de planning.';
  end if;
  return new;
end $$;
drop trigger if exists rental_availability on public.rentals;
create trigger rental_availability before insert or update of machine_id,start_date,end_date,status on public.rentals
for each row execute function public.guard_rental_availability();

create or replace function public.sync_rental_machine_status() returns trigger
language plpgsql set search_path=public as $$
begin
  update public.machines m set availability_status=case
    when exists(select 1 from public.rentals r where r.machine_id=m.id and r.status='active'
      and r.start_date<=(now() at time zone 'Europe/Amsterdam')::date and r.end_date>=(now() at time zone 'Europe/Amsterdam')::date)
      then 'rented'::public.machine_availability_status
    when m.availability_status='maintenance' then 'maintenance'::public.machine_availability_status
    else 'available'::public.machine_availability_status end,updated_at=now()
    where m.id=new.machine_id or (tg_op='UPDATE' and m.id=old.machine_id);
  return new;
end $$;
drop trigger if exists rental_machine_status on public.rentals;
create trigger rental_machine_status after insert or update on public.rentals
for each row execute function public.sync_rental_machine_status();

create or replace function public.guard_machine_rental_changes() returns trigger
language plpgsql set search_path=public as $$
begin
  if (new.customer_id is distinct from old.customer_id or
      (new.availability_status='maintenance' and old.availability_status<>'maintenance') or
      (coalesce(new.configuration->>'__archivedAt','')<>'' and coalesce(old.configuration->>'__archivedAt','')=''))
    and exists(select 1 from public.rentals r where r.machine_id=new.id and r.status='active'
      and r.end_date >= (now() at time zone 'Europe/Amsterdam')::date) then
    raise exception 'Deze machine heeft lopende of toekomstige verhuur. Handel die eerst af vóór overdracht of onderhoud.';
  end if;
  return new;
end $$;
drop trigger if exists machine_rental_changes on public.machines;
create trigger machine_rental_changes before update of customer_id,availability_status,configuration on public.machines
for each row execute function public.guard_machine_rental_changes();

create or replace function public.save_workshop_changes(
  p_previous jsonb,p_next jsonb,p_actor uuid,p_machine_changes jsonb default '[]'::jsonb
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare item jsonb; old_item jsonb; actual jsonb; collection text; target text; change jsonb;
  machine public.machines%rowtype; customer public.customers%rowtype; new_meta jsonb; old_meta jsonb; result jsonb;
begin
  perform pg_advisory_xact_lock(72190411);
  -- Compare only records actually changed. Different bonnen never overwrite one another.
  foreach collection in array array['jobs','transports'] loop
    target := case collection when 'jobs' then 'workshop_jobs' else 'workshop_transports' end;
    for item in select value from jsonb_array_elements(coalesce(p_next->collection,'[]')) loop
      select value into old_item from jsonb_array_elements(coalesce(p_previous->collection,'[]')) where value->>'id'=item->>'id';
      if item is not distinct from old_item then continue; end if;
      execute format('select data from public.%I where id=$1 for update',target) into actual using item->>'id';
      if actual is distinct from old_item then raise exception using errcode='40001',message='Deze bon is intussen gewijzigd.'; end if;
      execute format('insert into public.%I(id,data,updated_by) values($1,$2,$3) on conflict(id) do update set data=excluded.data,revision=%I.revision+1,updated_at=now(),updated_by=excluded.updated_by',target,target)
        using item->>'id',item,p_actor;
    end loop;
    if exists(select 1 from jsonb_array_elements(coalesce(p_previous->collection,'[]')) o
      where not exists(select 1 from jsonb_array_elements(coalesce(p_next->collection,'[]')) n where n->>'id'=o->>'id')) then
      raise exception 'Bonnen blijven bewaard; annuleer of markeer de bon als verwijderd.';
    end if;
  end loop;
  select data into actual from public.workshop_meta where id=1 for update;
  old_meta:=p_previous-'jobs'-'transports'; new_meta:=p_next-'jobs'-'transports';
  if (old_meta->'employees') is distinct from (new_meta->'employees') then
    if (actual->'employees') is distinct from (old_meta->'employees') then raise exception using errcode='40001',message='Medewerkers zijn gewijzigd.'; end if;
    actual:=jsonb_set(actual,'{employees}',new_meta->'employees');
  end if;
  actual:=actual || jsonb_build_object('nextJobNumber',greatest(coalesce((actual->>'nextJobNumber')::integer,1),coalesce((new_meta->>'nextJobNumber')::integer,1)),
    'taskSuggestions',(select coalesce(jsonb_agg(v),'[]') from (select distinct value v from jsonb_array_elements(coalesce(actual->'taskSuggestions','[]')||coalesce(new_meta->'taskSuggestions','[]'))) s));
  update public.workshop_meta set data=actual,version=version+1,updated_at=now(),updated_by=p_actor where id=1;

  for change in select value from jsonb_array_elements(p_machine_changes) loop
    select * into machine from public.machines where id=(change->>'machineId')::uuid for update;
    if machine.id is null or machine.customer_id::text<>change->>'expectedCustomerId' then
      raise exception using errcode='40001',message='De machine is intussen aan een andere klant gekoppeld.';
    end if;
    if coalesce(machine.configuration->>'__archivedAt','')<>'' then raise exception 'Een gearchiveerde machine kan niet worden gewijzigd.'; end if;
    if change ? 'hourReading' and coalesce(machine.configuration->>'hour_reading','')<>coalesce(change->>'expectedHourReading','') then
      raise exception using errcode='40001',message='De machine-urenstand is intussen gewijzigd.';
    end if;
    if change ? 'customerId' then
      select * into customer from public.customers where id=(change->>'customerId')::uuid;
      if customer.id is null then raise exception 'Koper niet gevonden.'; end if;
      update public.machines set customer_id=customer.id,configuration=configuration-'customer_location_id'-'location',updated_at=now() where id=machine.id;
      update public.planning_items set customer_id=customer.id,updated_at=now() where machine_id=machine.id and state<>'completed';
      -- Existing completed inspection snapshots remain unchanged. Draft documents
      -- are invalidated so no file with the previous customer can be sent.
      update public.inspections set customer_id=customer.id,customer_snapshot=jsonb_build_object(
        'customer_name',customer.company_name,'customer_address',coalesce(customer.address_line_1,''),
        'customer_contact',coalesce(customer.contact_name,''),'customer_contact_department','',
        'customer_phone',coalesce(customer.phone,''),'customer_email',coalesce(customer.email,'')),
        pdf_path=null,word_path=null,updated_at=now() where machine_id=machine.id and status='draft';
      delete from public.inspection_attachments a using public.inspections i where a.inspection_id=i.id and i.machine_id=machine.id and i.status='draft' and a.kind in ('pdf','word');
    end if;
    if change ? 'hourReading' then
      update public.machines set configuration=jsonb_set(configuration,'{hour_reading}',to_jsonb(change->>'hourReading')),updated_at=now() where id=machine.id;
    end if;
  end loop;

  -- Validate the merged database state, including concurrent inserts.
  if exists(select 1 from public.workshop_jobs j where coalesce(j.data->>'employee','')<>''
    and not exists(select 1 from public.workshop_meta m,jsonb_array_elements(m.data->'employees') e
      where e->>'id'=j.data->>'employee' and e->>'role'='mechanic')) then
    raise exception 'Een werkbon verwijst naar een ontbrekende monteur.';
  end if;
  if exists(select 1 from public.workshop_transports t left join public.workshop_jobs j on j.id=t.job_id
    where coalesce(t.data->>'driver','')<>'' and t.data->>'deletedAt' is null and
    (not exists(select 1 from public.workshop_meta m,jsonb_array_elements(m.data->'employees') e
      where e->>'id'=t.data->>'driver' and (e->>'role'='driver' or e->>'canDrive'='true'))
    or (t.job_id is not null and (j.data->>'status'='Geannuleerd'
      or (coalesce(t.data->>'legacyReleased','false')<>'true' and
       (j.data->>'status' not in ('Afgerond','Klaar voor transport') or j.data->>'invoicePaidAt' is null)))))) then
    raise exception 'Transport heeft een geldige chauffeur, kantoorcontrole en betaling nodig.';
  end if;
  if exists(select 1 from public.workshop_jobs a join public.workshop_jobs b on a.id<b.id
    and a.data->>'employee'=b.data->>'employee' and a.data->>'date'=b.data->>'date'
    where coalesce(a.data->>'employee','')<>'' and coalesce(a.data->>'date','')<>''
    and a.data->>'status' not in ('Afgerond','Klaar voor transport','Geannuleerd') and b.data->>'status' not in ('Afgerond','Klaar voor transport','Geannuleerd')
    and (a.data->>'time')::time < (b.data->>'time')::time+make_interval(mins=>(b.data->>'duration')::integer)
    and (b.data->>'time')::time < (a.data->>'time')::time+make_interval(mins=>(a.data->>'duration')::integer)) then
    raise exception 'De monteur heeft overlappende werkbonnen. Kies een ander tijdstip.';
  end if;
  -- Only changed orders are checked against existing rentals: unrelated historical
  -- inconsistencies must not stop every user from saving a note.
  for item in select n.value from jsonb_array_elements(p_next->'jobs') n where not exists(
    select 1 from jsonb_array_elements(p_previous->'jobs') o where o.value=n.value) loop
    if item->>'status' not in ('Afgerond','Klaar voor transport','Geannuleerd') and nullif(item->>'date','') is not null
      and exists(select 1 from public.rentals r where r.machine_id::text=item->>'machineId' and r.status='active'
        and public.workshop_rental_day(r.start_date,r.end_date,(item->>'date')::date)) then
      raise exception 'Deze machine is op de werkplaatsdatum verhuurd. Verplaats de bon of handel de verhuur eerst af.';
    end if;
  end loop;
  select jsonb_build_object('state',state,'version',version) into result from public.workshop_state where id=1;
  return result;
end $$;

revoke all on function public.save_workshop_changes(jsonb,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_workshop_changes(jsonb,jsonb,uuid,jsonb) to service_role;
revoke all on function public.workshop_rental_day(date,date,date),public.guard_rental_availability(),public.guard_machine_rental_changes(),public.sync_rental_machine_status() from public,anon,authenticated;
grant execute on function public.workshop_rental_day(date,date,date),public.guard_rental_availability(),public.guard_machine_rental_changes(),public.sync_rental_machine_status() to service_role;
notify pgrst, 'reload schema';
commit;
