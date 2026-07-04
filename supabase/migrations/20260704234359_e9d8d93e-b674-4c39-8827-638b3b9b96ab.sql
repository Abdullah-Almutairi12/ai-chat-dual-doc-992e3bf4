-- Move pg_net out of public (linter: extension_in_public)
SELECT cron.unschedule('tap-subscription-renewals')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tap-subscription-renewals');

DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'tap-subscription-renewals',
  '0 3 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://project--b4f885d5-2337-435a-8cce-f1c4b9bf02fd.lovable.app/api/public/tap-renew',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_zXmimyRU-bx9-kQContLlQ_wqSNjPV1'
    ),
    body := '{}'::jsonb
  );
  $$
);