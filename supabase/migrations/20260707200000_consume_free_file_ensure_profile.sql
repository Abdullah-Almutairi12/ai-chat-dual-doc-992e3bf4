-- Ensure consume_free_file works for users whose profile row was never created
-- (e.g. OAuth sign-up before trigger ran, or legacy accounts).

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

  INSERT INTO public.profiles (user_id, email, name)
  SELECT
    u.id,
    COALESCE(u.email, _user_id::text || '@users.local'),
    COALESCE(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'full_name',
      split_part(COALESCE(u.email, 'user'), '@', 1)
    )
  FROM auth.users u
  WHERE u.id = _user_id
  ON CONFLICT (user_id) DO NOTHING;

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
