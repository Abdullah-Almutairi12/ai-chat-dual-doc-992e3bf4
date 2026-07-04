CREATE TABLE IF NOT EXISTS public.payment_intents (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own payment intents" ON public.payment_intents;
CREATE POLICY "Users view own payment intents" ON public.payment_intents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);