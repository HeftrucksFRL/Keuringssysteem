do $$
begin
  create type public.machine_availability_status as enum (
    'available',
    'rented',
    'maintenance'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.rental_status as enum (
    'active',
    'completed'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.machines
add column if not exists availability_status public.machine_availability_status not null default 'available';

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

create index if not exists idx_rentals_machine_id on public.rentals(machine_id);
create index if not exists idx_rentals_customer_id on public.rentals(customer_id);
create index if not exists idx_rentals_start_date on public.rentals(start_date);
create index if not exists idx_rentals_end_date on public.rentals(end_date);

alter table public.rentals enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trg_rentals_updated_at on public.rentals;
create trigger trg_rentals_updated_at
before update on public.rentals
for each row execute procedure public.set_updated_at();
