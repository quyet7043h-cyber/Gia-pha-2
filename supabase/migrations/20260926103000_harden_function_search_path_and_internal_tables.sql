-- Security hardening: pin function search_path and close direct API access
-- to internal import/rate-limit tables. These tables are used by trusted
-- server-side code / Edge Functions and are not browser data endpoints.

ALTER FUNCTION public.f_unaccent(text)
  SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.maintain_unaccent()
  SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.trg_recompute_generation()
  SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.trg_soft_delete()
  SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.clans_maintain_name_unaccent()
  SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.set_updated_at()
  SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public._inlaw_person_card(public.persons, boolean)
  SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.feedback_sanitize_path()
  SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.touch_updated_at()
  SET search_path = public, pg_catalog, pg_temp;
ALTER FUNCTION public.custom_entries_touch()
  SET search_path = public, pg_catalog, pg_temp;

REVOKE ALL ON TABLE public.giapha_import_jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.giapha_import_chunks FROM anon, authenticated;
REVOKE ALL ON TABLE public.share_view_rate FROM anon, authenticated;
