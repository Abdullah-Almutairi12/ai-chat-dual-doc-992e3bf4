-- Move the has_role helper into a non-exposed "private" schema so signed-in
-- users can no longer call this SECURITY DEFINER function directly via the API,
-- while RLS policies keep using it internally.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
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

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate every policy that referenced public.has_role to use private.has_role
-- user_roles
DROP POLICY "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- profiles
DROP POLICY "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
DROP POLICY "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
DROP POLICY "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- documents
DROP POLICY "Admins can view all documents" ON public.documents;
CREATE POLICY "Admins can view all documents" ON public.documents
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
DROP POLICY "Admins can delete documents" ON public.documents;
CREATE POLICY "Admins can delete documents" ON public.documents
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- transactions
DROP POLICY "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions" ON public.transactions
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- system_settings
DROP POLICY "Admins can view settings" ON public.system_settings;
CREATE POLICY "Admins can view settings" ON public.system_settings
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
DROP POLICY "Admins can upsert settings" ON public.system_settings;
CREATE POLICY "Admins can upsert settings" ON public.system_settings
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- Finally remove the publicly-exposed SECURITY DEFINER function
DROP FUNCTION public.has_role(uuid, public.app_role);