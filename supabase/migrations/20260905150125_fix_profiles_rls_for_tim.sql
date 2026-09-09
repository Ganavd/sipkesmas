-- Allow all authenticated users to read basic profile information
-- This is necessary so that roles like perawat and keluarga can see 
-- the names of team members assigned to a visit (kunjungan_tim).

CREATE POLICY "profiles_select_all_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
