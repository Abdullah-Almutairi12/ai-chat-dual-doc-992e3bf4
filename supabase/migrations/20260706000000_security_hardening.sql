-- Security hardening: profile column guards, secure RPC, storage RLS, document delete policy

-- 1) Block direct updates to sensitive profile columns (credits, tier, free_claimed, banned)
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.credits IS DISTINCT FROM OLD.credits
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.free_claimed IS DISTINCT FROM OLD.free_claimed
     OR NEW.banned IS DISTINCT FROM OLD.banned THEN
    IF coalesce(current_setting('app.allow_profile_system', true), '') <> 'on'
       AND coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'sensitive profile fields can only be changed by the system';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- 2) Secure free-file consumption: only auth.uid(), no arbitrary user_id from client
CREATE OR REPLACE FUNCTION public.consume_free_file(_user_id uuid, _limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _rows integer;
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;
  IF _user_id IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'cannot consume credits for another user';
  END IF;
  PERFORM set_config('app.allow_files_processed', 'on', true);
  UPDATE public.profiles
    SET files_processed = files_processed + 1,
        updated_at = now()
    WHERE user_id = _uid
      AND files_processed < _limit;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_free_file(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) TO authenticated;

-- 3) Users may delete their own document records
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4) Storage bucket for user PDFs with strict RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-documents',
  'user-documents',
  false,
  20971520,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

DROP POLICY IF EXISTS "Users upload own documents" ON storage.objects;
CREATE POLICY "Users upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users read own documents" ON storage.objects;
CREATE POLICY "Users read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own documents" ON storage.objects;
CREATE POLICY "Users update own documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own documents" ON storage.objects;
CREATE POLICY "Users delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Admins read all storage" ON storage.objects;
CREATE POLICY "Admins read all storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND private.has_role(auth.uid(), 'admin')
  );
