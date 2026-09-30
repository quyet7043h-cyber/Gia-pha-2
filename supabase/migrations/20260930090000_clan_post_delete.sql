-- Cho phép admin xóa vĩnh viễn bài bảng tin.
-- Khác với hide: DELETE thật sẽ xóa cả comments/audit liên quan theo FK cascade.
create or replace function public.clan_post_moderate(
  p_post_id uuid,
  p_action  text,
  p_note    text default null
) returns void
  language plpgsql security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_post public.clan_posts;
    v_old  public.clan_post_status;
    v_new  public.clan_post_status;
    v_pin  boolean;
  begin
    select * into v_post from public.clan_posts where id = p_post_id;
    if not found then
      raise exception 'Không thấy bài';
    end if;

    if not (public.is_clan_admin(v_post.clan_id) or public.is_platform_admin()) then
      raise exception 'Không có quyền' using errcode = '42501';
    end if;

    if p_action = 'delete' then
      delete from public.clan_posts where id = p_post_id;
      return;
    end if;

    v_old := v_post.status;
    v_new := v_old;
    v_pin := v_post.pinned;

    case p_action
      when 'publish' then v_new := 'published';
      when 'reject' then  v_new := 'hidden';
      when 'hide' then    v_new := 'hidden';
      when 'unhide' then  v_new := 'published';
      when 'pin' then     v_pin := true;
      when 'unpin' then   v_pin := false;
      else raise exception 'Action không hợp lệ: %', p_action;
    end case;

    update public.clan_posts
      set status = v_new, pinned = v_pin
      where id = p_post_id;

    insert into public.clan_post_audit
      (post_id, actor_id, action, old_status, new_status, note)
    values
      (p_post_id, auth.uid(), p_action, v_old, v_new, p_note);
  end; $$;

revoke all on function public.clan_post_moderate(uuid, text, text)
  from public, anon;
grant execute on function public.clan_post_moderate(uuid, text, text)
  to authenticated;