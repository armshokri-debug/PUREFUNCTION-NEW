-- Private assessment videos (before/after). Files live under "<client_id>/...".
-- Coach: everything. Client: only files in their own folder (read).
-- (Applied to project pure-function-2 on 2026-10-25.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-videos', 'client-videos', false, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "client videos read" on storage.objects for select to authenticated
  using (bucket_id = 'client-videos'
         and ((select private.is_coach()) or (storage.foldername(name))[1] = (select private.my_client_id())));
create policy "client videos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-videos' and (select private.is_coach()));
create policy "client videos update" on storage.objects for update to authenticated
  using (bucket_id = 'client-videos' and (select private.is_coach()))
  with check (bucket_id = 'client-videos' and (select private.is_coach()));
create policy "client videos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'client-videos' and (select private.is_coach()));
