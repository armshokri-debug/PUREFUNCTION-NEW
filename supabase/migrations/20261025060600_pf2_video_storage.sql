-- Private bucket for the coach's exercise videos (played through short-lived signed links).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-videos', 'exercise-videos', false, 52428800,
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "exercise videos read" on storage.objects for select to authenticated
  using (bucket_id = 'exercise-videos' and (select private.has_profile()));
create policy "exercise videos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-videos' and (select private.is_coach()));
create policy "exercise videos update" on storage.objects for update to authenticated
  using (bucket_id = 'exercise-videos' and (select private.is_coach()))
  with check (bucket_id = 'exercise-videos' and (select private.is_coach()));
create policy "exercise videos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-videos' and (select private.is_coach()));
