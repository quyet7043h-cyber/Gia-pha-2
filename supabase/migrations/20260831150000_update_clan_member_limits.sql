-- ============================================================================
-- Update clan member limits
-- Admin  : maximum 2
-- Editor : maximum 20
-- Viewer : unlimited
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Add separate limits for admin and editor
-- --------------------------------------------------------------------------

alter table public.clans
add column if not exists max_admins int not null default 2;

alter table public.clans
add column if not exists max_editors int not null default 20;


-- --------------------------------------------------------------------------
-- 2. Update existing clans
-- --------------------------------------------------------------------------

update public.clans
set
  max_admins = 2,
  max_editors = 20
where max_admins is null
   or max_editors is null;


-- --------------------------------------------------------------------------
-- 3. Replace member limit trigger
-- --------------------------------------------------------------------------

create or replace function public.enforce_max_users()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  admin_count int;
  editor_count int;
  admin_limit int;
  editor_limit int;
begin

  -- Viewer does not consume any seat.
  if new.role = 'viewer' then
    return new;
  end if;


  -- If an existing admin/editor is only changing other information,
  -- do not count the same seat again.
  if TG_OP = 'UPDATE' and old.role = new.role then
    return new;
  end if;


  -- Lock this clan during the check to prevent two people
  -- joining at exactly the same time.
  perform pg_advisory_xact_lock(
    hashtext('member_limits:' || new.clan_id::text)::bigint
  );


  -- Get limits.
  select
    coalesce(max_admins, 2),
    coalesce(max_editors, 20)
  into
    admin_limit,
    editor_limit
  from public.clans
  where id = new.clan_id;


  -- Count current admins.
  select count(*)
  into admin_count
  from public.clan_members
  where clan_id = new.clan_id
    and role = 'admin';


  -- Count current editors.
  select count(*)
  into editor_count
  from public.clan_members
  where clan_id = new.clan_id
    and role = 'editor';


  -- ------------------------------------------------------------------------
  -- Admin limit
  -- ------------------------------------------------------------------------

  if new.role = 'admin' and admin_count >= admin_limit then
    raise exception 'Clan has reached max_admins limit (%)', admin_limit
      using errcode = 'check_violation';
  end if;


  -- ------------------------------------------------------------------------
  -- Editor limit
  -- ------------------------------------------------------------------------

  if new.role = 'editor' and editor_count >= editor_limit then
    raise exception 'Clan has reached max_editors limit (%)', editor_limit
      using errcode = 'check_violation';
  end if;


  return new;

end;
$$;


-- --------------------------------------------------------------------------
-- 4. Recreate trigger
-- --------------------------------------------------------------------------

drop trigger if exists enforce_max_users_trg
on public.clan_members;

create trigger enforce_max_users_trg
before insert or update of role
on public.clan_members
for each row
execute function public.enforce_max_users();
