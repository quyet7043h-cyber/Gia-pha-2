-- Fix generation trigger after the SECURITY DEFINER hardening migration.
--
-- The trigger function runs in the caller's security context. It calls
-- recompute_generation_for_clan(), whose EXECUTE privilege was intentionally
-- removed from browser roles. Make the trigger function SECURITY DEFINER so
-- it can invoke the internal recompute function without exposing that RPC
-- directly to anon/authenticated clients.

ALTER FUNCTION public.trg_recompute_generation()
  SECURITY DEFINER
  SET search_path = public, pg_catalog, pg_temp;

REVOKE EXECUTE ON FUNCTION public.recompute_generation_for_clan(uuid)
  FROM anon, authenticated;
