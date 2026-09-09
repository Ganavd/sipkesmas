-- =====================================================================
-- PERBAIKAN BUG — RPC keluarga belum cek deleted_at, jadi bisa "berhasil"
-- di baris yang sebenarnya sudah di-soft-delete oleh Perawat/Admin.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.kunjungan_ajukan_resmi(_kunjungan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _puskesmas_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'keluarga'::app_role) THEN
    RAISE EXCEPTION 'Hanya akun Keluarga yang bisa mengajukan resmi kunjungan.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kunjungan kj
    JOIN public.keluarga k ON k.id = kj.keluarga_id
    WHERE kj.id = _kunjungan_id AND k.user_id = auth.uid()
      AND kj.is_registered = false AND kj.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Naskah sudah dihapus atau sudah terdaftar sebelumnya.';
  END IF;

  UPDATE public.kunjungan
  SET is_registered = true, registered_at = now(), registered_by = auth.uid()
  WHERE id = _kunjungan_id
  RETURNING puskesmas_id INTO _puskesmas_id;

  PERFORM public.log_audit(auth.uid(), 'ajukan_resmi', 'kunjungan', _kunjungan_id, _puskesmas_id,
    'Keluarga mengajukan resmi jadwal kunjungan', '{}'::jsonb);
END $$;

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
    WHERE kj.id = _kunjungan_id AND k.user_id = auth.uid()
      AND kj.is_registered = false AND kj.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Naskah sudah dihapus atau sudah terdaftar resmi.';
  END IF;

  UPDATE public.kunjungan
  SET tanggal_kunjungan = _tanggal_baru
  WHERE id = _kunjungan_id
  RETURNING puskesmas_id INTO _puskesmas_id;

  PERFORM public.log_audit(auth.uid(), 'ubah_jadwal', 'kunjungan', _kunjungan_id, _puskesmas_id,
    'Keluarga mengajukan perubahan jadwal kunjungan', jsonb_build_object('tanggal_baru', _tanggal_baru));
END $$;

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
  WHERE kj.id = _kunjungan_id AND k.user_id = auth.uid()
    AND kj.is_registered = false AND kj.deleted_at IS NULL;

  IF _puskesmas_id IS NULL THEN
    RAISE EXCEPTION 'Naskah sudah dihapus atau sudah terdaftar resmi.';
  END IF;

  UPDATE public.kunjungan
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = _kunjungan_id;

  PERFORM public.log_audit(auth.uid(), 'delete', 'kunjungan', _kunjungan_id, _puskesmas_id,
    'Keluarga menghapus pengajuan kunjungan (belum terdaftar resmi)', '{}'::jsonb);
END $$;