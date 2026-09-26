-- Create the private person photo storage bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('person-photos', 'person-photos', false, 10485760, array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do nothing;
