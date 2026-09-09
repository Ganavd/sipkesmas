-- =====================================================================
-- Bucket Storage buat lampiran (surat izin kunjungan, dst) + izin akses.
-- Bucket dibuat PUBLIC (URL bisa diakses langsung tanpa signed-url) --
-- cukup buat surat izin/perizinan yang bukan data medis sensitif. Kalau
-- nanti dipakai buat lampiran yang lebih sensitif, pertimbangkan bucket
-- private + signed URL.
-- =====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS attachments_storage_insert ON storage.objects;
CREATE POLICY attachments_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS attachments_storage_update ON storage.objects;
CREATE POLICY attachments_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS attachments_storage_delete ON storage.objects;
CREATE POLICY attachments_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'attachments');

-- ---------- Keluarga bisa baca lampiran milik kunjungan mereka sendiri ----------
DROP POLICY IF EXISTS attach_keluarga_select ON public.attachments;
CREATE POLICY attach_keluarga_select ON public.attachments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'keluarga')
    AND entity_type = 'kunjungan'
    AND EXISTS (
      SELECT 1 FROM public.kunjungan kj
      JOIN public.keluarga k ON k.id = kj.keluarga_id
      WHERE kj.id = attachments.entity_id AND k.user_id = auth.uid()
    )
  );