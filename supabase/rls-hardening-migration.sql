alter table if exists public.profiles enable row level security;
alter table if exists public.inspection_sequences enable row level security;

drop policy if exists "authenticated read own profile" on public.profiles;
create policy "authenticated read own profile" on public.profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "authenticated update own profile" on public.profiles;
create policy "authenticated update own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
