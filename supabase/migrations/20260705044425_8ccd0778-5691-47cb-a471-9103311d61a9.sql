CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_new_user_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
BEGIN
  PERFORM net.http_post(
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

REVOKE ALL ON FUNCTION public.notify_new_user_welcome() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_new_user_welcome() TO service_role;