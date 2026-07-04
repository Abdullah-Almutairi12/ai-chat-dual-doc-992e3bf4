-- Atomic, service-role-only credit increment
CREATE OR REPLACE FUNCTION public.add_credits(_user_id uuid, _amount integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET credits = credits + _amount, updated_at = now()
  WHERE user_id = _user_id;
$$;
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer) TO service_role;

-- transactions: extra columns + idempotency on the payment id
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS plan_id text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'purchase';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_invoice_id_key') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_invoice_id_key UNIQUE (invoice_id);
  END IF;
END $$;

-- profiles: track one-time free-plan claim
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_claimed boolean NOT NULL DEFAULT false;

-- subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  credits_per_cycle integer NOT NULL DEFAULT 0,
  tap_customer_id text,
  tap_card_id text,
  last_charge_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins view all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_plan_key') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_plan_key UNIQUE (user_id, plan_id);
  END IF;
END $$;

-- Daily renewal scheduler (calls the public renewal endpoint)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('tap-subscription-renewals')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tap-subscription-renewals');

SELECT cron.schedule(
  'tap-subscription-renewals',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--b4f885d5-2337-435a-8cce-f1c4b9bf02fd.lovable.app/api/public/tap-renew',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_zXmimyRU-bx9-kQContLlQ_wqSNjPV1'
    ),
    body := '{}'::jsonb
  );
  $$
);