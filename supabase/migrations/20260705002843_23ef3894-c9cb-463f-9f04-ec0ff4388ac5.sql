-- Idempotency flag so the welcome email is sent exactly once per user.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_sent boolean NOT NULL DEFAULT false;

-- After a new profile is created (registration), notify the app to send the
-- welcome email through Resend. Uses pg_net so it never blocks signup.
CREATE OR REPLACE FUNCTION public.notify_new_user_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM extensions.http_post(
    url := 'https://project--b4f885d5-2337-435a-8cce-f1c4b9bf02fd.lovable.app/api/public/send-welcome',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '2fc3001fa578bdff37a62040e62bf6bffd0d30525f684198cee7cadfbc71f78d'
    ),
    body := jsonb_build_object('user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_welcome ON public.profiles;
CREATE TRIGGER on_profile_created_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_new_user_welcome();