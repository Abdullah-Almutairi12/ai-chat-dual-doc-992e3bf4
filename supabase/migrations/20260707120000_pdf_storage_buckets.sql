-- PDF Quanta storage buckets: files, documents, pdf-tools
-- (Replaces legacy single-bucket setup; keeps user-documents if already present.)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'files',
    'files',
    false,
    20971520,
    ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]::text[]
  ),
  (
    'documents',
    'documents',
    false,
    52428800,
    ARRAY[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/html',
      'image/png',
      'image/jpeg'
    ]::text[]
  ),
  (
    'pdf-tools',
    'pdf-tools',
    false,
    20971520,
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: users read/write only under their uid prefix in each bucket.
DO $$
DECLARE
  b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['files', 'documents', 'pdf-tools']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users upload own %1$s" ON storage.objects', b);
    EXECUTE format($p$
      CREATE POLICY "Users upload own %1$s" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = %2$L
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$, b, b);

    EXECUTE format('DROP POLICY IF EXISTS "Users read own %1$s" ON storage.objects', b);
    EXECUTE format($p$
      CREATE POLICY "Users read own %1$s" ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = %2$L
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$, b, b);

    EXECUTE format('DROP POLICY IF EXISTS "Users update own %1$s" ON storage.objects', b);
    EXECUTE format($p$
      CREATE POLICY "Users update own %1$s" ON storage.objects
        FOR UPDATE TO authenticated
        USING (
          bucket_id = %2$L
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$, b, b);

    EXECUTE format('DROP POLICY IF EXISTS "Users delete own %1$s" ON storage.objects', b);
    EXECUTE format($p$
      CREATE POLICY "Users delete own %1$s" ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id = %2$L
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$, b, b);

    EXECUTE format('DROP POLICY IF EXISTS "Admins read all %1$s" ON storage.objects', b);
    EXECUTE format($p$
      CREATE POLICY "Admins read all %1$s" ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = %2$L
          AND public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    $p$, b, b);
  END LOOP;
END $$;
