insert into storage.buckets (id, name, public)
values ('inspection-files', 'inspection-files', false)
on conflict (id) do nothing;

create policy "authenticated can read inspection-files"
on storage.objects
for select
to authenticated
using (bucket_id = 'inspection-files');

create policy "authenticated can write inspection-files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'inspection-files');

create policy "authenticated can update inspection-files"
on storage.objects
for update
to authenticated
using (bucket_id = 'inspection-files');
