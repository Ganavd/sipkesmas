-- Memulihkan RLS Select untuk tabel asuhan_keperawatan yang terhapus

-- Pastikan policy lama dengan nama yang sama dihapus terlebih dahulu jika ada
DROP POLICY IF EXISTS "Askep select sesuai role" ON public.asuhan_keperawatan;
DROP POLICY IF EXISTS "Semua melihat asuhan_keperawatan" ON public.asuhan_keperawatan;
DROP POLICY IF EXISTS asuhan_select ON public.asuhan_keperawatan;

-- Buat ulang policy select
CREATE POLICY "Askep select sesuai role" ON public.asuhan_keperawatan
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'admin_dinkes'
    OR (
      public.get_user_role(auth.uid()) IN ('admin_puskesmas', 'perawat')
      AND public.get_user_puskesmas_id(auth.uid()) = puskesmas_id
    )
    OR (
      public.get_user_role(auth.uid()) = 'keluarga'
      AND EXISTS (
        SELECT 1
        FROM public.kunjungan kj
        JOIN public.keluarga kg ON kg.id = kj.keluarga_id
        WHERE kj.id = asuhan_keperawatan.kunjungan_id
          AND (kg.user_id = auth.uid() OR kg.created_by = auth.uid())
      )
    )
  );
