create or replace function public.join_clan_by_share_token(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_clan_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select sl.clan_id
    into v_clan_id
  from public.share_links sl
  where sl.token = p_token
    and sl.is_revoked = false
    and (
      sl.expires_at is null
      or sl.expires_at > now()
    )
  limit 1;

  if v_clan_id is null then
    raise exception 'Invalid or expired share token';
  end if;

  if exists (
    select 1
    from public.clan_members cm
    where cm.clan_id = v_clan_id
      and cm.user_id = v_user
  ) then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_member',
      'clan_id', v_clan_id
    );
  end if;

  insert into public.clan_members (
    clan_id,
    user_id,
    role
  )
  values (
    v_clan_id,
    v_user,
    'viewer'
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'joined',
    'clan_id', v_clan_id
  );
end;
$$;

revoke all on function public.join_clan_by_share_token(text)
from public, anon;

grant execute on function public.join_clan_by_share_token(text)
to authenticated;
