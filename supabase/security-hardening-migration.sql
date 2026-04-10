create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.next_inspection_number(target_date date default current_date)
returns integer
language plpgsql
set search_path = public
as $$
declare
  target_year integer := extract(year from target_date);
  suffix integer := (target_year % 100);
  base_number integer := suffix * 1000 + 1;
  next_number integer;
begin
  insert into public.inspection_sequences (sequence_year, last_number)
  values (target_year, base_number)
  on conflict (sequence_year) do nothing;

  update public.inspection_sequences
  set last_number = case
    when last_number < base_number then base_number
    else last_number + 1
  end,
  updated_at = now()
  where sequence_year = target_year
  returning last_number into next_number;

  return next_number;
end;
$$;

create or replace function public.finalize_inspection()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('completed', 'approved', 'rejected') and coalesce(new.inspection_number, 0) = 0 then
    new.inspection_number := public.next_inspection_number(new.inspection_date);
  end if;

  if new.status in ('completed', 'approved', 'rejected') then
    new.next_inspection_date := (new.inspection_date + interval '12 months')::date;
  end if;

  return new;
end;
$$;

drop policy if exists "authenticated read customers" on public.customers;
drop policy if exists "authenticated write customers" on public.customers;
drop policy if exists "authenticated read customer contacts" on public.customer_contacts;
drop policy if exists "authenticated write customer contacts" on public.customer_contacts;
drop policy if exists "authenticated read machines" on public.machines;
drop policy if exists "authenticated write machines" on public.machines;
drop policy if exists "authenticated read inspections" on public.inspections;
drop policy if exists "authenticated write inspections" on public.inspections;
drop policy if exists "authenticated read attachments" on public.inspection_attachments;
drop policy if exists "authenticated write attachments" on public.inspection_attachments;
drop policy if exists "authenticated read planning" on public.planning_items;
drop policy if exists "authenticated write planning" on public.planning_items;
drop policy if exists "authenticated read rentals" on public.rentals;
drop policy if exists "authenticated write rentals" on public.rentals;
drop policy if exists "authenticated read mail events" on public.mail_events;
drop policy if exists "authenticated write mail events" on public.mail_events;
