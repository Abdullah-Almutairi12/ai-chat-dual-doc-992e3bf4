-- 1) Free-trial usage counter on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS files_processed integer NOT NULL DEFAULT 0;

-- 2) Guard: only the system (via the security-definer RPC or service_role) may
--    change files_processed. Prevents users resetting their own free trial.
CREATE OR REPLACE FUNCTION public.guard_files_processed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.files_processed IS DISTINCT FROM OLD.files_processed THEN
    IF coalesce(current_setting('app.allow_files_processed', true), '') <> 'on'
       AND coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'files_processed can only be changed by the system';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_files_processed ON public.profiles;
CREATE TRIGGER trg_guard_files_processed
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_files_processed();

-- 3) Atomic free-file consumption: increments only while under the limit.
--    Returns true when a free try was available and consumed.
CREATE OR REPLACE FUNCTION public.consume_free_file(_user_id uuid, _limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _rows integer;
BEGIN
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

GRANT EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) TO authenticated;