
-- ============ PUSKESMAS ============
CREATE TABLE public.puskesmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_puskesmas text NOT NULL,
  alamat text,
  kecamatan text,
  kabupaten text,
  telepon text,
  email text,
  status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','nonaktif')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.puskesmas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER puskesmas_updated_at
BEFORE UPDATE ON public.puskesmas
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ PROFILES extension ============
ALTER TABLE public.profiles
  ADD COLUMN username text,
  ADD COLUMN email text,
  ADD COLUMN puskesmas_id uuid REFERENCES public.puskesmas(id) ON DELETE SET NULL,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (lower(username));

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.get_user_puskesmas_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT puskesmas_id FROM public.profiles WHERE id = _user_id $$;

CREATE OR REPLACE FUNCTION public.count_perawat_in_puskesmas(_puskesmas_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'perawat' AND p.puskesmas_id = _puskesmas_id
$$;

CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT email FROM public.profiles WHERE lower(username) = lower(_username) LIMIT 1 $$;

-- ============ RLS: puskesmas ============
CREATE POLICY puskesmas_select_all ON public.puskesmas FOR SELECT TO authenticated USING (true);
CREATE POLICY puskesmas_admin_insert ON public.puskesmas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin_dinkes'));
CREATE POLICY puskesmas_admin_update ON public.puskesmas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin_dinkes'));
CREATE POLICY puskesmas_admin_delete ON public.puskesmas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin_dinkes'));

-- ============ RLS: profiles (extend) ============
CREATE POLICY profiles_admin_dinkes_select ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin_dinkes'));
CREATE POLICY profiles_admin_puskesmas_select ON public.profiles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin_puskesmas')
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );
CREATE POLICY profiles_admin_dinkes_update ON public.profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin_dinkes'));
CREATE POLICY profiles_admin_dinkes_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin_dinkes'));

-- ============ RLS: user_roles (extend) ============
CREATE POLICY user_roles_admin_puskesmas_insert ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin_puskesmas')
    AND role IN ('perawat','keluarga')
  );
CREATE POLICY user_roles_admin_puskesmas_select ON public.user_roles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin_puskesmas')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.puskesmas_id = public.get_user_puskesmas_id(auth.uid())
    )
  );

-- ============ Updated handle_new_user ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role public.app_role;
  _username text;
  _puskesmas_id uuid;
BEGIN
  _username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));

  BEGIN
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'keluarga'::public.app_role);
  EXCEPTION WHEN OTHERS THEN
    _role := 'keluarga'::public.app_role;
  END;

  BEGIN
    _puskesmas_id := NULLIF(NEW.raw_user_meta_data->>'puskesmas_id','')::uuid;
  EXCEPTION WHEN OTHERS THEN
    _puskesmas_id := NULL;
  END;

  INSERT INTO public.profiles (id, full_name, phone, username, email, puskesmas_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    _username,
    NEW.email,
    _puskesmas_id
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
