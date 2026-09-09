GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_puskesmas_id(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.count_perawat_in_puskesmas(uuid) TO authenticated, anon;