create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  target_label text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

create index if not exists idx_activity_logs_created_at
on public.activity_logs(created_at desc);

create index if not exists idx_activity_logs_actor_id
on public.activity_logs(actor_id);

create index if not exists idx_activity_logs_entity
on public.activity_logs(entity_type, entity_id);
