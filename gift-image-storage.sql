-- Diese Erweiterung wurde in Supabase bereits angewendet.
-- Einmalig für neue Installationen ausführen (nicht bei bestehender Wunschfunken-Seite erforderlich).
-- Bilder sind öffentlich sichtbar, Änderungen ausschließlich Administratoren erlaubt.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gift-images', 'gift-images', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/gif']::text[])
on conflict (id) do nothing;

create policy "Wunschfunken admin uploads gift images" on storage.objects
for insert to authenticated with check (
  bucket_id='gift-images'
  and (storage.foldername(name))[1]='gifts'
  and exists (select 1 from public.admins where id=(select auth.uid()))
);

create policy "Wunschfunken admin lists gift images" on storage.objects
for select to authenticated using (
  bucket_id='gift-images'
  and (storage.foldername(name))[1]='gifts'
  and exists (select 1 from public.admins where id=(select auth.uid()))
);

create policy "Wunschfunken admin deletes gift images" on storage.objects
for delete to authenticated using (
  bucket_id='gift-images'
  and (storage.foldername(name))[1]='gifts'
  and exists (select 1 from public.admins where id=(select auth.uid()))
);
