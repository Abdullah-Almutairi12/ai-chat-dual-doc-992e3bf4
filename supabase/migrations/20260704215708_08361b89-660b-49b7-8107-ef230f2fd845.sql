-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  name text NOT NULL DEFAULT 'New User',
  email text NOT NULL,
  tier text NOT NULL DEFAULT 'free',
  credits integer NOT NULL DEFAULT 100,
  banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  tool_used text NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all documents" ON public.documents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete documents" ON public.documents
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  invoice_id text NOT NULL,
  user_email text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'succeeded',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all transactions" ON public.transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- System settings
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  label text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settings" ON public.system_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can upsert settings" ON public.system_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- New user handler: create profile + default user role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed demo profiles
INSERT INTO public.profiles (name, email, tier, credits, banned, created_at) VALUES
  ('Sara Al-Mansour', 'sara.mansour@example.com', 'premium', 820, false, now() - interval '95 days'),
  ('James Carter', 'james.carter@example.com', 'free', 40, false, now() - interval '80 days'),
  ('Layla Hassan', 'layla.hassan@example.com', 'premium', 610, false, now() - interval '61 days'),
  ('Michael Chen', 'michael.chen@example.com', 'free', 12, false, now() - interval '48 days'),
  ('Noura Abdullah', 'noura.abdullah@example.com', 'premium', 1500, false, now() - interval '30 days'),
  ('David Kim', 'david.kim@example.com', 'free', 0, true, now() - interval '22 days'),
  ('Fatima Zahra', 'fatima.zahra@example.com', 'free', 88, false, now() - interval '14 days'),
  ('Omar Farouk', 'omar.farouk@example.com', 'premium', 300, false, now() - interval '5 days');

-- Seed demo documents
INSERT INTO public.documents (user_email, file_name, file_size, tool_used, created_at) VALUES
  ('sara.mansour@example.com', 'Q4-Financial-Report.pdf', 2456789, 'analyzer', now() - interval '2 days'),
  ('james.carter@example.com', 'lease-agreement.pdf', 892340, 'analyzer', now() - interval '3 days'),
  ('layla.hassan@example.com', 'research-tables.pdf', 1567002, 'tables', now() - interval '4 days'),
  ('michael.chen@example.com', 'essay-draft.pdf', 245008, 'proofreader', now() - interval '6 days'),
  ('noura.abdullah@example.com', 'contract-2026.pdf', 3120500, 'chat', now() - interval '7 days'),
  ('fatima.zahra@example.com', 'scanned-invoice.pdf', 780122, 'converter', now() - interval '9 days'),
  ('omar.farouk@example.com', 'course-material.pdf', 4560001, 'quiz', now() - interval '11 days'),
  ('sara.mansour@example.com', 'balance-sheet.pdf', 1998450, 'tables', now() - interval '13 days');

-- Seed demo transactions
INSERT INTO public.transactions (invoice_id, user_email, amount, currency, status, created_at) VALUES
  ('INV-100241', 'sara.mansour@example.com', 29.00, 'USD', 'succeeded', now() - interval '2 days'),
  ('INV-100238', 'layla.hassan@example.com', 29.00, 'USD', 'succeeded', now() - interval '8 days'),
  ('INV-100235', 'noura.abdullah@example.com', 99.00, 'USD', 'succeeded', now() - interval '15 days'),
  ('INV-100230', 'omar.farouk@example.com', 29.00, 'USD', 'succeeded', now() - interval '19 days'),
  ('INV-100228', 'michael.chen@example.com', 9.00, 'USD', 'refunded', now() - interval '24 days'),
  ('INV-100221', 'sara.mansour@example.com', 29.00, 'USD', 'succeeded', now() - interval '33 days'),
  ('INV-100215', 'james.carter@example.com', 9.00, 'USD', 'failed', now() - interval '41 days'),
  ('INV-100210', 'noura.abdullah@example.com', 99.00, 'USD', 'succeeded', now() - interval '46 days');

-- Seed default settings
INSERT INTO public.system_settings (key, value, label) VALUES
  ('max_file_size_free_mb', '10', 'Max file size for Free users (MB)'),
  ('max_file_size_premium_mb', '100', 'Max file size for Premium users (MB)'),
  ('cost_per_credit_usd', '0.05', 'Cost per credit (USD)'),
  ('free_monthly_credits', '100', 'Free monthly credits'),
  ('ai_api_key', '', 'System-wide AI API key');