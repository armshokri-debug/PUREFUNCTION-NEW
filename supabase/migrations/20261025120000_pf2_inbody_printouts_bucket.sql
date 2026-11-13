-- Private InBody printouts (photo or PDF). Files live under "<client_id>/...".
-- Coach: everything. Client: can only read files in their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inbody-printouts', 'inbody-printouts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "inbody read" on storage.objects for select to authenticated
  using (bucket_id = 'inbody-printouts'
         and ((select private.is_coach()) or (storage.foldername(name))[1] = (select private.my_client_id())));
create policy "inbody upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'inbody-printouts' and (select private.is_coach()));
create policy "inbody update" on storage.objects for update to authenticated
  using (bucket_id = 'inbody-printouts' and (select private.is_coach()))
  with check (bucket_id = 'inbody-printouts' and (select private.is_coach()));
create policy "inbody delete" on storage.objects for delete to authenticated
  using (bucket_id = 'inbody-printouts' and (select private.is_coach()));
