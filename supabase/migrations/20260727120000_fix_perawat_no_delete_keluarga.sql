-- =====================================================================
-- PERBAIKAN BUG — Perawat saat ini bisa "Hapus" (soft-delete) data Keluarga
-- lewat policy keluarga_puskesmas_update yang mengizinkan Admin Puskesmas
-- DAN Perawat UPDATE tanpa pembeda. Padahal rencana kita: Perawat cuma
-- boleh Tambah/Edit/Lihat, TIDAK boleh Hapus (lihat sipkesmas-rencana-revisi.md
-- bagian 5). Hapus di sini terjadi lewat UPDATE (set deleted_at), jadi
-- dibedakan lewat WITH CHECK: kalau deleted_at mau diisi (bukan NULL),
-- cuma Admin Puskesmas/Dinkes yang boleh.
-- =====================================================================

DROP POLICY IF EXISTS keluarga_puskesmas_update ON public.keluarga;
CREATE POLICY keluarga_puskesmas_update ON public.keluarga FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin_puskesmas') OR public.has_role(auth.uid(), 'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin_puskesmas') OR public.has_role(auth.uid(), 'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
    AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin_puskesmas'))
  );
