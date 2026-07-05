REVOKE EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_free_file(uuid, integer) TO authenticated;