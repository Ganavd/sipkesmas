
-- Reinstate auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill orphan users
INSERT INTO public.profiles (id, full_name, phone, username, email, puskesmas_id)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name',''),
       COALESCE(u.raw_user_meta_data->>'phone',''),
       COALESCE(u.raw_user_meta_data->>'username', split_part(u.email,'@',1)),
       u.email,
       NULLIF(u.raw_user_meta_data->>'puskesmas_id','')::uuid
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
       COALESCE((u.raw_user_meta_data->>'role')::public.app_role, 'keluarga'::public.app_role)
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;
