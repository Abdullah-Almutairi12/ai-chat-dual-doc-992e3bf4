-- Restrict SECURITY DEFINER RPCs: block direct client invocation via PostgREST.
-- consume_free_file is only called from trusted server handlers (service_role).

CREATE OR REPLACE FUNCTION public.consume_free_file(_user_id uuid, _limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _rows integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.allow_files_processed', 'on', true);
  UPDATE public.profiles
    SET files_processed = files_processed + 1,
        updated_at = now()
    WHERE user_id = _user_id
      AND files_processed < _limit;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_free_file(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) TO service_role;

-- add_credits: already service_role-only; re-assert grants after any drift
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer) TO service_role;

-- Trigger helpers must never be callable from the API
REVOKE ALL ON FUNCTION public.notify_new_user_welcome() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_new_user_welcome() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
