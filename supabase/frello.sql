begin;
create table if not exists public.frello_boards (
 id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 100),
 visibility text not null check(visibility in ('shared','private')),owner_id uuid references auth.users(id),
 state jsonb not null,version integer not null default 0 check(version>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(visibility='shared' or owner_id is not null)
);
alter table public.frello_boards enable row level security;
revoke all on public.frello_boards from anon,authenticated;
grant select on public.frello_boards to authenticated;
grant insert(title,visibility,owner_id,state) on public.frello_boards to authenticated;
grant update(title,state,version,updated_at) on public.frello_boards to authenticated;
-- Only the existing Age/Renze accounts; metadata-based tablet accounts are excluded.
drop policy if exists frello_board_access on public.frello_boards;
create policy frello_board_access on public.frello_boards for select to authenticated using (
 lower(auth.jwt()->>'email') in ('info@heftrucks.frl','info@terpstratrading.frl','info@heftruckopleiding.frl') and
 coalesce(auth.jwt()->'app_metadata'->>'app_role','') <> 'workshop_viewer' and
 (visibility='shared' or owner_id=auth.uid())
);
drop policy if exists frello_board_insert on public.frello_boards;
create policy frello_board_insert on public.frello_boards for insert to authenticated with check (
 lower(auth.jwt()->>'email') in ('info@heftrucks.frl','info@terpstratrading.frl','info@heftruckopleiding.frl') and
 coalesce(auth.jwt()->'app_metadata'->>'app_role','') <> 'workshop_viewer' and owner_id=auth.uid()
);
drop policy if exists frello_board_update on public.frello_boards;
create policy frello_board_update on public.frello_boards for update to authenticated
 using (visibility='shared' or owner_id=auth.uid()) with check (visibility='shared' or owner_id=auth.uid());
-- SELECT policy also applies to UPDATE. A restrictive policy guards all commands.
drop policy if exists frello_account_scope on public.frello_boards;
create policy frello_account_scope on public.frello_boards as restrictive for all to authenticated
 using (lower(auth.jwt()->>'email') in ('info@heftrucks.frl','info@terpstratrading.frl','info@heftruckopleiding.frl') and coalesce(auth.jwt()->'app_metadata'->>'app_role','') <> 'workshop_viewer')
 with check (lower(auth.jwt()->>'email') in ('info@heftrucks.frl','info@terpstratrading.frl','info@heftruckopleiding.frl') and coalesce(auth.jwt()->'app_metadata'->>'app_role','') <> 'workshop_viewer');
create table if not exists public.frello_files (
 id uuid primary key,board_id uuid not null references public.frello_boards(id),card_id uuid not null,
 path text not null unique,name text not null,size bigint not null check(size between 1 and 4194304),created_at timestamptz not null default now()
);
alter table public.frello_files enable row level security;
revoke all on public.frello_files from anon,authenticated;
grant select,insert on public.frello_files to authenticated;
drop policy if exists frello_files_access on public.frello_files;
create policy frello_files_access on public.frello_files for select to authenticated using(exists(select 1 from public.frello_boards b where b.id=board_id));
drop policy if exists frello_files_insert on public.frello_files;
create policy frello_files_insert on public.frello_files for insert to authenticated with check(
 exists(select 1 from public.frello_boards b where b.id=board_id) and split_part(path,'/',1)=board_id::text and split_part(path,'/',2)=card_id::text
);
insert into storage.buckets(id,name,public,file_size_limit) values('frello-attachments','frello-attachments',false,4194304) on conflict(id) do nothing;
drop policy if exists frello_storage_read on storage.objects;
create policy frello_storage_read on storage.objects for select to authenticated using(bucket_id='frello-attachments' and exists(select 1 from public.frello_boards b where b.id::text=(storage.foldername(name))[1]));
drop policy if exists frello_storage_insert on storage.objects;
create policy frello_storage_insert on storage.objects for insert to authenticated with check(bucket_id='frello-attachments' and exists(select 1 from public.frello_boards b where b.id::text=(storage.foldername(name))[1]));
drop policy if exists frello_storage_cleanup on storage.objects;
create policy frello_storage_cleanup on storage.objects for delete to authenticated using(bucket_id='frello-attachments' and exists(select 1 from public.frello_boards b where b.id::text=(storage.foldername(name))[1]));
-- Other pre-existing storage policies must not bypass board privacy.
drop policy if exists frello_storage_privacy on storage.objects;
create policy frello_storage_privacy on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'frello-attachments' or exists(select 1 from public.frello_boards b where b.id::text=(storage.foldername(name))[1]))
 with check(bucket_id<>'frello-attachments' or exists(select 1 from public.frello_boards b where b.id::text=(storage.foldername(name))[1]));
insert into public.frello_boards(id,title,visibility,state) values(
 'f0000000-0000-4000-8000-000000000001','Leads Age & Renze','shared',
 '{"columns":[{"id":"f1000000-0000-4000-8000-000000000001","name":"Nieuwe leads"},{"id":"f1000000-0000-4000-8000-000000000002","name":"Contact gelegd"},{"id":"f1000000-0000-4000-8000-000000000003","name":"Offerte verstuurd"},{"id":"f1000000-0000-4000-8000-000000000004","name":"Opvolgen"},{"id":"f1000000-0000-4000-8000-000000000005","name":"Gewonnen"},{"id":"f1000000-0000-4000-8000-000000000006","name":"Verloren"}],"cards":[]}'::jsonb
) on conflict(id) do nothing;
commit;
