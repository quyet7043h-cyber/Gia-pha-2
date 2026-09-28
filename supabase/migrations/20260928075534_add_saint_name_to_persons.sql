-- Add Catholic baptismal/patron saint name to each person.
alter table public.persons
  add column if not exists saint_name text;
