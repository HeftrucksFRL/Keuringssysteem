create extension if not exists pgcrypto;

create type public.machine_type as enum (
  'heftruck_reachtruck',
  'batterij_lader',
  'graafmachine',
  'hoogwerker',
  'palletwagen_stapelaar',
  'shovel',
  'verreiker',
  'stellingmateriaal'
);

create type public.inspection_status as enum (
  'draft',
  'completed',
  'approved',
  'rejected'
);

create type public.machine_availability_status as enum (
  'available',
  'rented',
  'maintenance'
);

create type public.rental_status as enum (
  'active',
  'completed'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'inspector',
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  address_line_1 text,
  address_line_2 text,
  postal_code text,
  city text,
  country text default 'Nederland',
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_customers_company_name_unique
on public.customers(company_name);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  machine_number text not null unique,
  machine_type public.machine_type not null,
  availability_status public.machine_availability_status not null default 'available',
  brand text,
  model text,
  serial_number text,
  build_year integer,
  internal_number text,
  dossier_number text,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_sequences (
  sequence_year integer primary key,
  last_number integer not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  inspection_number integer not null unique,
  machine_id uuid not null references public.machines(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  inspector_id uuid references public.profiles(id) on delete set null,
  machine_type public.machine_type not null,
  status public.inspection_status not null default 'draft',
  inspection_date date not null,
  next_inspection_date date,
  checklist jsonb not null default '{}'::jsonb,
  machine_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  findings text,
  recommendations text,
  conclusion text,
  send_pdf_to_customer boolean not null default false,
  pdf_path text,
  word_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_attachments (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  bucket text not null default 'inspection-files',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  kind text not null check (kind in ('photo', 'pdf', 'word')),
  created_at timestamptz not null default now()
);

create table if not exists public.mail_events (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  recipient text not null,
  subject text not null,
  channel text not null check (channel in ('internal', 'customer')),
  delivery_status text not null default 'queued',
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.planning_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid references public.inspections(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  due_date date not null,
  state text not null check (state in ('upcoming', 'overdue', 'scheduled', 'completed')),
  scheduled_for date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status public.rental_status not null default 'active',
  price text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.next_inspection_number(target_date date default current_date)
returns integer
language plpgsql
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

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_customer_contacts_updated_at on public.customer_contacts;
create trigger trg_customer_contacts_updated_at
before update on public.customer_contacts
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_machines_updated_at on public.machines;
create trigger trg_machines_updated_at
before update on public.machines
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_inspections_updated_at on public.inspections;
create trigger trg_inspections_updated_at
before update on public.inspections
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_planning_updated_at on public.planning_items;
create trigger trg_planning_updated_at
before update on public.planning_items
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_rentals_updated_at on public.rentals;
create trigger trg_rentals_updated_at
before update on public.rentals
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_finalize_inspection on public.inspections;
create trigger trg_finalize_inspection
before insert or update on public.inspections
for each row execute procedure public.finalize_inspection();

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.machines enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_attachments enable row level security;
alter table public.mail_events enable row level security;
alter table public.planning_items enable row level security;
alter table public.rentals enable row level security;

create policy "authenticated read customers" on public.customers
for select to authenticated using (true);

create policy "authenticated write customers" on public.customers
for all to authenticated using (true) with check (true);

create policy "authenticated read customer contacts" on public.customer_contacts
for select to authenticated using (true);

create policy "authenticated write customer contacts" on public.customer_contacts
for all to authenticated using (true) with check (true);

create policy "authenticated read machines" on public.machines
for select to authenticated using (true);

create policy "authenticated write machines" on public.machines
for all to authenticated using (true) with check (true);

create policy "authenticated read inspections" on public.inspections
for select to authenticated using (true);

create policy "authenticated write inspections" on public.inspections
for all to authenticated using (true) with check (true);

create policy "authenticated read attachments" on public.inspection_attachments
for select to authenticated using (true);

create policy "authenticated write attachments" on public.inspection_attachments
for all to authenticated using (true) with check (true);

create policy "authenticated read planning" on public.planning_items
for select to authenticated using (true);

create policy "authenticated write planning" on public.planning_items
for all to authenticated using (true) with check (true);

create policy "authenticated read rentals" on public.rentals
for select to authenticated using (true);

create policy "authenticated write rentals" on public.rentals
for all to authenticated using (true) with check (true);

create index if not exists idx_machines_customer_id on public.machines(customer_id);
create index if not exists idx_customer_contacts_customer_id on public.customer_contacts(customer_id);
create index if not exists idx_inspections_machine_id on public.inspections(machine_id);
create index if not exists idx_inspections_customer_id on public.inspections(customer_id);
create index if not exists idx_inspections_date on public.inspections(inspection_date desc);
create index if not exists idx_planning_due_date on public.planning_items(due_date);
create index if not exists idx_rentals_machine_id on public.rentals(machine_id);
create index if not exists idx_rentals_customer_id on public.rentals(customer_id);
create index if not exists idx_rentals_start_date on public.rentals(start_date);
create index if not exists idx_rentals_end_date on public.rentals(end_date);
