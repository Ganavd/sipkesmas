
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_puskesmas_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_perawat_in_puskesmas(uuid) FROM PUBLIC, anon, authenticated;
