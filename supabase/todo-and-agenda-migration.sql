create table if not exists public.todo_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todo_items enable row level security;
alter table public.agenda_events enable row level security;

drop policy if exists "authenticated read own todo items" on public.todo_items;
create policy "authenticated read own todo items" on public.todo_items
for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "authenticated write own todo items" on public.todo_items;
create policy "authenticated write own todo items" on public.todo_items
for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "authenticated read own agenda events" on public.agenda_events;
create policy "authenticated read own agenda events" on public.agenda_events
for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "authenticated write own agenda events" on public.agenda_events;
create policy "authenticated write own agenda events" on public.agenda_events
for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists idx_todo_items_owner_id on public.todo_items(owner_id);
create index if not exists idx_todo_items_due_date on public.todo_items(due_date);
create index if not exists idx_agenda_events_owner_id on public.agenda_events(owner_id);
create index if not exists idx_agenda_events_event_date on public.agenda_events(event_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trg_todo_items_updated_at on public.todo_items;
create trigger trg_todo_items_updated_at
before update on public.todo_items
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_agenda_events_updated_at on public.agenda_events;
create trigger trg_agenda_events_updated_at
before update on public.agenda_events
for each row execute procedure public.set_updated_at();
