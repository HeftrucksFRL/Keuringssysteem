-- Archiefbak werkbonnen. Installeer na rental-open-transport.sql. Geen gegevens worden verwijderd.
begin;
select pg_advisory_xact_lock(72190411);
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
  if exists(select 1 from public.workshop_jobs j where j.data->>'deletedAt' is null and coalesce(j.data->>'employee','')<>''
    and not exists(select 1 from public.workshop_meta m,jsonb_array_elements(m.data->'employees') e
      where e->>'id'=j.data->>'employee' and e->>'role'='mechanic')) then
    raise exception 'Een werkbon verwijst naar een ontbrekende monteur.';
  end if;
  if exists(select 1 from public.workshop_transports t left join public.workshop_jobs j on j.id=t.job_id
    where coalesce(t.data->>'driver','')<>'' and t.data->>'deletedAt' is null and
    (not exists(select 1 from public.workshop_meta m,jsonb_array_elements(m.data->'employees') e
      where e->>'id'=t.data->>'driver' and (e->>'role'='driver' or e->>'canDrive'='true'))
    or (t.job_id is not null and (j.data->>'deletedAt' is not null or j.data->>'status'='Geannuleerd'
      or (coalesce(t.data->>'legacyReleased','false')<>'true' and
       (j.data->>'status' not in ('Afgerond','Klaar voor transport') or j.data->>'invoicePaidAt' is null)))))) then
    raise exception 'Transport heeft een geldige chauffeur, kantoorcontrole en betaling nodig.';
  end if;
  if exists(select 1 from public.workshop_jobs a join public.workshop_jobs b on a.id<b.id
    and a.data->>'employee'=b.data->>'employee' and a.data->>'date'=b.data->>'date'
    where a.data->>'deletedAt' is null and b.data->>'deletedAt' is null and coalesce(a.data->>'employee','')<>'' and coalesce(a.data->>'date','')<>''
    and a.data->>'status' not in ('Afgerond','Klaar voor transport','Geannuleerd') and b.data->>'status' not in ('Afgerond','Klaar voor transport','Geannuleerd')
    and (a.data->>'time')::time < (b.data->>'time')::time+make_interval(mins=>(b.data->>'duration')::integer)
    and (b.data->>'time')::time < (a.data->>'time')::time+make_interval(mins=>(a.data->>'duration')::integer)) then
    raise exception 'De monteur heeft overlappende werkbonnen. Kies een ander tijdstip.';
  end if;
  -- Only changed orders are checked against existing rentals: unrelated historical
  -- inconsistencies must not stop every user from saving a note.
  for item in select n.value from jsonb_array_elements(p_next->'jobs') n where not exists(
    select 1 from jsonb_array_elements(p_previous->'jobs') o where o.value=n.value) loop
    if item->>'deletedAt' is null and item->>'status' not in ('Afgerond','Klaar voor transport','Geannuleerd') and nullif(item->>'date','') is not null
      and exists(select 1 from public.rentals r where r.machine_id::text=item->>'machineId' and r.status='active'
        and public.workshop_rental_day(r.start_date,r.end_date,(item->>'date')::date)) then
      raise exception 'Deze machine is op de werkplaatsdatum verhuurd. Verplaats de bon of handel de verhuur eerst af.';
    end if;
  end loop;
  select jsonb_build_object('state',state,'version',version) into result from public.workshop_state where id=1;
  return result;
end $$;


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
    and j.data->>'deletedAt' is null and j.data->>'status' not in ('Afgerond','Klaar voor transport','Geannuleerd')
    and nullif(j.data->>'date','') is not null
    and public.workshop_rental_day(new.start_date,new.end_date,(j.data->>'date')::date)) then
    raise exception 'Deze machine heeft werkplaatswerk in de gekozen verhuurperiode. Rond dat af of verplaats de planning.';
  end if;
  return new;
end $$;

notify pgrst,'reload schema';
commit;
