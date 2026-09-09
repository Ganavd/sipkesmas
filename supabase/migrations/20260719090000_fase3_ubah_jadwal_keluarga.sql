-- =====================================================================
-- FASE 3.3 — RPC: Keluarga mengajukan perubahan jadwal kunjungan (masih draft)
-- Rujukan: sipkesmas-rencana-revisi.md bagian 6.2
-- =====================================================================

CREATE OR REPLACE FUNCTION public.kunjungan_ubah_jadwal_keluarga(_kunjungan_id uuid, _tanggal_baru timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _puskesmas_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'keluarga'::app_role) THEN
    RAISE EXCEPTION 'Hanya akun Keluarga yang bisa mengajukan perubahan jadwal.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kunjungan kj
    JOIN public.keluarga k ON k.id = kj.keluarga_id
    WHERE kj.id = _kunjungan_id AND k.created_by = auth.uid() AND kj.is_registered = false
  ) THEN
    RAISE EXCEPTION 'Kunjungan tidak ditemukan, sudah terdaftar resmi, atau bukan milik Anda.';
  END IF;

  -- updated_at otomatis ke-bump lewat trg_kunjungan_updated_at yang sudah ada
  UPDATE public.kunjungan
  SET tanggal_kunjungan = _tanggal_baru
  WHERE id = _kunjungan_id
  RETURNING puskesmas_id INTO _puskesmas_id;

  PERFORM public.log_audit(auth.uid(), 'ubah_jadwal', 'kunjungan', _kunjungan_id, _puskesmas_id,
    'Keluarga mengajukan perubahan jadwal kunjungan', jsonb_build_object('tanggal_baru', _tanggal_baru));
END $$;

REVOKE ALL ON FUNCTION public.kunjungan_ubah_jadwal_keluarga(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kunjungan_ubah_jadwal_keluarga(uuid, timestamptz) TO authenticated;

-- ---------- Keluarga hapus pengajuan yang masih draft ----------
CREATE OR REPLACE FUNCTION public.kunjungan_hapus_keluarga(_kunjungan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _puskesmas_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'keluarga'::app_role) THEN
    RAISE EXCEPTION 'Hanya akun Keluarga yang bisa menghapus pengajuan ini.';
  END IF;

  SELECT kj.puskesmas_id INTO _puskesmas_id
  FROM public.kunjungan kj
  JOIN public.keluarga k ON k.id = kj.keluarga_id
  WHERE kj.id = _kunjungan_id AND k.created_by = auth.uid() AND kj.is_registered = false;

  IF _puskesmas_id IS NULL THEN
    RAISE EXCEPTION 'Kunjungan tidak ditemukan, sudah terdaftar resmi, atau bukan milik Anda.';
  END IF;

  UPDATE public.kunjungan
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = _kunjungan_id;

  PERFORM public.log_audit(auth.uid(), 'delete', 'kunjungan', _kunjungan_id, _puskesmas_id,
    'Keluarga menghapus pengajuan kunjungan (belum terdaftar resmi)', '{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.kunjungan_hapus_keluarga(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kunjungan_hapus_keluarga(uuid) TO authenticated;
