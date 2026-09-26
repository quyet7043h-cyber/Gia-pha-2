-- Harden SECURITY DEFINER RPC privileges.
DO $$ DECLARE fn record; BEGIN FOR fn IN SELECT n.nspname AS schema_name,p.proname,pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',fn.schema_name,fn.proname,fn.args); END LOOP; END $$;
GRANT EXECUTE ON FUNCTION public.get_notification_by_token(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.peek_clan_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_link_token(text) TO anon;
