-- Secure billing cron + re-assert RPC execute grants (overrides earlier GRANT to authenticated).

-- Settings used by pg_cron → pg_net (must match server env CRON_SECRET / APP_ORIGIN).
INSERT INTO public.system_settings (key, value, label)
VALUES
  (
    'cron_webhook_secret',
    '',
    'Shared secret for pg_net cron calls (must match CRON_SECRET env var)'
  ),
  (
    'tap_renew_url',
    'https://pdfquanta.online/api/public/tap-renew',
    'Daily subscription renewal endpoint URL'
  )
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label;

-- Replace insecure cron job that used the public Supabase publishable key.
SELECT cron.unschedule('tap-subscription-renewals')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tap-subscription-renewals');

SELECT cron.schedule(
  'tap-subscription-renewals',
  '0 3 * * *',
  $$
  SELECT extensions.http_post(
    url := coalesce(
      nullif((SELECT value FROM public.system_settings WHERE key = 'tap_renew_url'), ''),
      'https://pdfquanta.online/api/public/tap-renew'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce((SELECT value FROM public.system_settings WHERE key = 'cron_webhook_secret'), '')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- SECURITY DEFINER RPCs: service_role only (not callable via PostgREST as authenticated).
REVOKE ALL ON FUNCTION public.consume_free_file(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer) TO service_role;
