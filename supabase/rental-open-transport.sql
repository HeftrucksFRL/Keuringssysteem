-- Open huurperioden en expliciet gekozen verhuurtransport. Na workshop-relational.sql.
begin;
select pg_advisory_xact_lock(72190411);
alter table public.rentals alter column end_date drop not null;
alter table public.rentals add column if not exists version integer not null default 1;
alter table public.rentals add column if not exists transport jsonb not null default '{}';
alter table public.rentals drop constraint if exists rental_completed_end;
alter table public.rentals add constraint rental_completed_end check(status<>'completed' or end_date is not null);
alter table public.workshop_transports add column if not exists rental_id uuid generated always as (nullif(data->>'rentalId','')::uuid) stored references public.rentals(id);
create unique index if not exists workshop_transport_rental_leg on public.workshop_transports(rental_id,(data->>'rentalLeg')) where rental_id is not null;
-- Preserve every old ticket; new orders use an explicit choice.
update public.workshop_jobs j set data=data||jsonb_build_object('transportRequired',exists(select 1 from public.workshop_transports t where t.job_id=j.id and t.data->>'deletedAt' is null))
 where not(data ? 'transportRequired');
create or replace function public.workshop_rental_day(p_start date,p_end date,p_day date)
returns boolean language sql stable set search_path=public as $$
 select p_day>=p_start and (p_end is null or p_end<(now() at time zone 'Europe/Amsterdam')::date or p_day<p_end or p_start=p_end and p_day=p_start)
$$;
create or replace function public.guard_rental_availability() returns trigger
language plpgsql set search_path=public as $$
declare machine public.machines%rowtype;
begin
  -- Shared transaction lock orders rental and workshop decisions. It is brief;
  -- unrelated stale forms are merged per record, not rejected by this lock.
  perform pg_advisory_xact_lock(72190411);
  if new.end_date<new.start_date then raise exception 'De einddatum mag niet vóór de startdatum liggen.'; end if;
  if new.status='completed' then
    if new.end_date is null or new.end_date>(now() at time zone 'Europe/Amsterdam')::date then raise exception 'Vul bij afsluiten een geldige werkelijke einddatum in.'; end if;
    return new;
  end if;
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
    and daterange(new.start_date,case when new.end_date<(now() at time zone 'Europe/Amsterdam')::date then null when new.end_date=new.start_date then new.end_date+1 else new.end_date end,'[)')
     && daterange(r.start_date,case when r.end_date<(now() at time zone 'Europe/Amsterdam')::date then null when r.end_date=r.start_date then r.end_date+1 else r.end_date end,'[)')) then
    raise exception 'Deze machine is in die periode al verhuurd (mogelijk met open einddatum).';
  end if;
  if exists(select 1 from public.workshop_jobs j where j.machine_id=new.machine_id::text
    and j.data->>'status' not in ('Afgerond','Klaar voor transport','Geannuleerd')
    and nullif(j.data->>'date','') is not null
    and public.workshop_rental_day(new.start_date,new.end_date,(j.data->>'date')::date)) then
    raise exception 'Deze machine heeft werkplaatswerk in de gekozen verhuurperiode. Rond dat af of verplaats de planning.';
  end if;
  return new;
end $$;
create or replace function public.sync_rental_machine_status() returns trigger
language plpgsql set search_path=public as $$
begin
  update public.machines m set availability_status=case
    when exists(select 1 from public.rentals r where r.machine_id=m.id and r.status='active'
      and r.start_date<=(now() at time zone 'Europe/Amsterdam')::date )
      then 'rented'::public.machine_availability_status
    when m.availability_status='maintenance' then 'maintenance'::public.machine_availability_status
    else 'available'::public.machine_availability_status end,updated_at=now()
    where m.id=new.machine_id or (tg_op='UPDATE' and m.id=old.machine_id);
  return new;
end $$;
create or replace function public.guard_machine_rental_changes() returns trigger
language plpgsql set search_path=public as $$
begin
  if (new.customer_id is distinct from old.customer_id or
      (new.availability_status='maintenance' and old.availability_status<>'maintenance') or
      (coalesce(new.configuration->>'__archivedAt','')<>'' and coalesce(old.configuration->>'__archivedAt','')=''))
    and exists(select 1 from public.rentals r where r.machine_id=new.id and r.status='active'
) then
    raise exception 'Deze machine heeft lopende of toekomstige verhuur. Handel die eerst af vóór overdracht of onderhoud.';
  end if;
  return new;
end $$;

create or replace function public.sync_rental_transports() returns trigger
language plpgsql security invoker set search_path=public as $$
declare leg text; needed boolean; ticket_id text; existing public.workshop_transports%rowtype;
 customer public.customers%rowtype; machine public.machines%rowtype; payload jsonb; changed boolean:=false;
begin
 select * into customer from public.customers where id=new.customer_id;
 select * into machine from public.machines where id=new.machine_id;
 foreach leg in array array['delivery','collection'] loop
  needed:=coalesce((new.transport->>leg)::boolean,false);
  ticket_id:='rental-'||new.id::text||'-'||leg;
  select * into existing from public.workshop_transports where id=ticket_id for update;
  if not needed then
   if existing.id is not null and existing.data->>'deletedAt' is null then
    if existing.data->>'state' in ('Onderweg','Afgeleverd') then raise exception 'Een gestarte of afgeleverde verhuurrit kan niet worden uitgezet.'; end if;
    update public.workshop_transports set data=data||jsonb_build_object('deletedAt',now()),revision=revision+1,updated_at=now() where id=ticket_id;changed:=true;
   end if;
   continue;
  end if;
  -- A rental edit must never silently overwrite a planner's live route details.
  if existing.id is not null and tg_op='UPDATE' and old.transport=new.transport and old.customer_id=new.customer_id then continue; end if;
  if existing.id is not null and existing.data->>'state' in ('Onderweg','Afgeleverd') then
   if old.customer_id<>new.customer_id then raise exception 'De klant van een gestarte verhuurrit kan niet worden gewijzigd.'; end if;
   continue;
  end if;
  payload:=jsonb_build_object('id',ticket_id,'rentalId',new.id,'rentalLeg',leg,
   'kind',case leg when 'delivery' then 'Verhuur brengen' else 'Verhuur ophalen' end,
   'title',case leg when 'delivery' then 'Verhuur brengen · ' else 'Verhuur ophalen · ' end||coalesce(machine.brand,'')||' · '||coalesce(machine.model,''),
   'customer',customer.company_name,'machine',coalesce(machine.brand,'')||' · '||coalesce(machine.model,''),
   'pickup',case leg when 'delivery' then 'Eigen werkplaats' else coalesce(new.transport->>'address','') end,
   'address',case leg when 'delivery' then coalesce(new.transport->>'address','') else 'Eigen werkplaats' end,
   'contact',coalesce(new.transport->>'contact',''),'instructions',coalesce(new.transport->>'instructions',''),
   'driver','','date','','appointmentTime','','position',0,'state','Nieuw','confirmation','');
  if existing.id is not null and existing.data->>'deletedAt' is null then
   payload:=payload||jsonb_build_object('driver',existing.data->>'driver','date',existing.data->>'date',
    'appointmentTime',existing.data->>'appointmentTime','position',existing.data->'position','state',existing.data->>'state','confirmation',existing.data->>'confirmation');
  end if;
  insert into public.workshop_transports(id,data) values(ticket_id,payload)
   on conflict(id) do update set data=excluded.data,revision=workshop_transports.revision+1,updated_at=now();changed:=true;
 end loop;
 if changed then update public.workshop_meta set version=version+1,updated_at=now() where id=1; end if;
 return new;
end $$;
drop trigger if exists rental_transports on public.rentals;
create trigger rental_transports after insert or update of transport,customer_id on public.rentals for each row execute function public.sync_rental_transports();

create or replace function public.save_rental(p_id uuid,p_action text,p_data jsonb,p_expected_version integer)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current public.rentals%rowtype; result public.rentals%rowtype; end_day date;
begin
 perform pg_advisory_xact_lock(72190411);
 select * into current from public.rentals where id=p_id for update;
 if p_action='create' then
  if current.id is not null then
   if current.machine_id::text=p_data->>'machineId' and current.customer_id::text=p_data->>'customerId'
      and current.start_date=(p_data->>'startDate')::date and current.end_date is not distinct from nullif(p_data->>'endDate','')::date
      and coalesce(current.price,'')=coalesce(p_data->>'price','') and current.transport=coalesce(p_data->'transport','{}') then return to_jsonb(current); end if;
   raise exception using errcode='40001',message='Dit verhuurverzoek bestaat al. Vernieuw de lijst.';
  end if;
  insert into public.rentals(id,machine_id,customer_id,start_date,end_date,status,price,transport)
   values(p_id,(p_data->>'machineId')::uuid,(p_data->>'customerId')::uuid,(p_data->>'startDate')::date,nullif(p_data->>'endDate','')::date,'active',nullif(p_data->>'price',''),coalesce(p_data->'transport','{}')) returning * into result;
 else
  if current.id is null then raise exception 'Verhuur niet gevonden.'; end if;
  if current.version<>p_expected_version then raise exception using errcode='40001',message='Deze verhuur is intussen gewijzigd. Vernieuw de lijst.'; end if;
  if current.status='completed' then raise exception 'Deze verhuur is al afgesloten.'; end if;
  if p_action='complete' then
   end_day:=nullif(p_data->>'endDate','')::date;
   if end_day is null or end_day<current.start_date or end_day>(now() at time zone 'Europe/Amsterdam')::date then raise exception 'Vul een geldige werkelijke einddatum in.'; end if;
   if exists(select 1 from public.workshop_transports where rental_id=p_id and data->>'deletedAt' is null
     and ((data->>'rentalLeg'='collection' and data->>'state'<>'Afgeleverd') or data->>'state'='Onderweg')) then
    raise exception 'Rond eerst het ophaaltransport af voordat je de verhuur afsluit.';
   end if;
   update public.rentals set end_date=end_day,status='completed',version=version+1,updated_at=now() where id=p_id returning * into result;
   update public.workshop_transports set data=data||jsonb_build_object('deletedAt',now()),revision=revision+1,updated_at=now()
     where rental_id=p_id and data->>'rentalLeg'='delivery' and data->>'deletedAt' is null and data->>'state' in ('Nieuw','Gepland');
   update public.workshop_meta set version=version+1,updated_at=now() where id=1;
  elsif p_action='update' then
   update public.rentals set customer_id=(p_data->>'customerId')::uuid,start_date=(p_data->>'startDate')::date,
    end_date=nullif(p_data->>'endDate','')::date,price=nullif(p_data->>'price',''),transport=coalesce(p_data->'transport',transport),version=version+1,updated_at=now()
    where id=p_id returning * into result;
  else raise exception 'Onbekende verhuuractie.';
  end if;
 end if;
 return to_jsonb(result);
end $$;
revoke all on function public.save_rental(uuid,text,jsonb,integer),public.sync_rental_transports() from public,anon,authenticated;
grant execute on function public.save_rental(uuid,text,jsonb,integer),public.sync_rental_transports() to service_role;
notify pgrst,'reload schema';
commit;
