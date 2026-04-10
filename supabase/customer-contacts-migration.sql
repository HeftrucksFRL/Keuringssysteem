create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  department text,
  phone text,
  email text,
  is_primary boolean not null default false,
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

drop trigger if exists trg_customer_contacts_updated_at on public.customer_contacts;
create trigger trg_customer_contacts_updated_at
before update on public.customer_contacts
for each row execute procedure public.set_updated_at();

alter table public.customer_contacts enable row level security;

create index if not exists idx_customer_contacts_customer_id
on public.customer_contacts(customer_id);

alter table public.customer_contacts
add column if not exists department text;

insert into public.customer_contacts (customer_id, name, phone, email, is_primary)
select
  c.id,
  coalesce(nullif(c.contact_name, ''), c.company_name),
  c.phone,
  c.email,
  true
from public.customers c
where not exists (
  select 1
  from public.customer_contacts cc
  where cc.customer_id = c.id
)
and (
  coalesce(nullif(c.contact_name, ''), '') <> ''
  or coalesce(nullif(c.phone, ''), '') <> ''
  or coalesce(nullif(c.email, ''), '') <> ''
);
