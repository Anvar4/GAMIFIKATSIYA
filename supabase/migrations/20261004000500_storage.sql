-- =====================================================================
-- 5-migratsiya: savol rasmlari uchun Supabase Storage bucket
-- Oʻqituvchi savol muharririda kompyuterdan rasm yuklaydi; rasmlar
-- ommaviy (public) oʻqiladi, lekin faqat oʻqituvchilar yuklay/oʻchira oladi.
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage sxemasi topilmadi — bucket yaratilmadi';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('question-images', 'question-images', true, 2097152,
          array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  on conflict (id) do update
    set public = true, file_size_limit = 2097152,
        allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

  execute $p$drop policy if exists question_images_read on storage.objects$p$;
  execute $p$drop policy if exists question_images_insert on storage.objects$p$;
  execute $p$drop policy if exists question_images_update on storage.objects$p$;
  execute $p$drop policy if exists question_images_delete on storage.objects$p$;

  execute $p$create policy question_images_read on storage.objects
    for select using (bucket_id = 'question-images')$p$;
  execute $p$create policy question_images_insert on storage.objects
    for insert to authenticated with check (bucket_id = 'question-images' and public.is_instructor())$p$;
  execute $p$create policy question_images_update on storage.objects
    for update to authenticated using (bucket_id = 'question-images' and public.is_instructor())$p$;
  execute $p$create policy question_images_delete on storage.objects
    for delete to authenticated using (bucket_id = 'question-images' and public.is_instructor())$p$;
end;
$$;
