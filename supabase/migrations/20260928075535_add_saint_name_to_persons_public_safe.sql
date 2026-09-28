-- Expose saint_name in the public-safe person view while keeping
-- living-person personal fields masked, consistent with existing naming fields.
drop view if exists public.persons_public_safe;

create view public.persons_public_safe
  with (security_invoker = false) as
  select
    p.id, p.clan_id, p.full_name, p.full_name_unaccent, p.gender,
    p.generation, p.branch_id, p.is_living, p.is_root,
    case when p.is_living then null else p.birth_date end as birth_date,
    case when p.is_living then null else p.birth_date_precision end as birth_date_precision,
    case when p.is_living then null else p.death_date end as death_date,
    case when p.is_living then null else p.death_date_precision end as death_date_precision,
    case when p.is_living then null else p.birth_place end as birth_place,
    case when p.is_living then null else p.burial_place end as burial_place,
    case when p.is_living then null else p.photo_path end as photo_path,
    case when p.is_living then null else p.bio end as bio,
    case when p.is_living then null else p.saint_name end as saint_name,
    case when p.is_living then null else p.courtesy_name end as courtesy_name,
    case when p.is_living then null else p.posthumous_name end as posthumous_name,
    case when p.is_living then null else p.nickname end as nickname,
    case when p.is_living then null else p.birth_lunar_year end as birth_lunar_year,
    case when p.is_living then null else p.birth_lunar_month end as birth_lunar_month,
    case when p.is_living then null else p.birth_lunar_day end as birth_lunar_day,
    case when p.is_living then null else p.death_lunar_year end as death_lunar_year,
    case when p.is_living then null else p.death_lunar_month end as death_lunar_month,
    case when p.is_living then null else p.death_lunar_day end as death_lunar_day,
    case when p.is_living then null else p.death_anniv_lunar_month end as death_anniv_lunar_month,
    case when p.is_living then null else p.death_anniv_lunar_day end as death_anniv_lunar_day,
    p.death_anniv_lunar_is_leap,
    case when p.is_living then null else p.lifespan_years end as lifespan_years,
    p.birth_family_id, p.birth_order
  from public.persons p
  where p.deleted_at is null
    and exists (
      select 1 from public.clans c
      where c.id = p.clan_id
        and (c.visibility = 'public' or public.is_clan_member(c.id) or public.is_platform_admin())
    );

revoke all on public.persons_public_safe from public;
revoke all on public.persons_public_safe from anon;
grant select on public.persons_public_safe to authenticated;
