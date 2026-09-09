-- =====================================================================
-- PERBAIKAN BUG — Keluarga tidak bisa lihat data miliknya sendiri
-- Akar masalah: tabel keluarga tidak punya kolom penghubung ke akun login-nya
-- sendiri. 3 RLS policy salah cek `created_by` (staff yang input data),
-- seharusnya cek akun login keluarga itu sendiri.
-- =====================================================================

-- ---------- 1. Kolom penghubung akun login keluarga ----------
ALTER TABLE public.keluarga
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.keluarga.user_id IS
  'Akun auth.users yang dipakai keluarga ini login (BEDA dari created_by, yang isinya staff yang menginput data)';

-- ---------- 2. Perbaiki 3 RLS policy: created_by -> user_id ----------
DROP POLICY IF EXISTS keluarga_self_select ON public.keluarga;
CREATE POLICY keluarga_self_select ON public.keluarga FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'keluarga')
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS anggota_self_select ON public.anggota_keluarga;
CREATE POLICY anggota_self_select ON public.anggota_keluarga FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.keluarga k
      WHERE k.id = anggota_keluarga.keluarga_id
        AND public.has_role(auth.uid(), 'keluarga')
        AND k.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS kunjungan_keluarga_select ON public.kunjungan;
CREATE POLICY kunjungan_keluarga_select ON public.kunjungan
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'keluarga') AND EXISTS (
      SELECT 1 FROM public.keluarga k WHERE k.id = kunjungan.keluarga_id AND k.user_id = auth.uid()
    )
  );

-- ---------- 3. Catatan penting ----------
-- Migrasi ini BELUM otomatis mengisi user_id untuk data yang sudah ada, dan
-- createKeluarga() di actions/keluarga.ts BELUM membuat akun login sekalian
-- (itu scope Fase 4 - form Manajemen Keluarga). Untuk sekarang, keluarga baru
-- yang dibuat tetap perlu di-link manual sampai Fase 4 kelar.