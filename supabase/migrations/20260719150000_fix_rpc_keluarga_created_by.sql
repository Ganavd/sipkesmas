-- =====================================================================
-- PERBAIKAN BUG — 3 RPC keluarga masih pakai k.created_by = auth.uid()
-- (bug yang sama seperti RLS sebelumnya, ketinggalan waktu ditulis sebelum
-- bug created_by vs user_id ditemukan). Ganti ke k.user_id = auth.uid().
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
    WHERE kj.id = _kunjungan_id AND k.user_id = auth.uid() AND kj.is_registered = false
  ) THEN
    RAISE EXCEPTION 'Kunjungan tidak ditemukan atau sudah terdaftar sebelumnya.';
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
    WHERE kj.id = _kunjungan_id AND k.user_id = auth.uid() AND kj.is_registered = false
  ) THEN
    RAISE EXCEPTION 'Kunjungan tidak ditemukan, sudah terdaftar resmi, atau bukan milik Anda.';
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
  WHERE kj.id = _kunjungan_id AND k.user_id = auth.uid() AND kj.is_registered = false;

  IF _puskesmas_id IS NULL THEN
    RAISE EXCEPTION 'Kunjungan tidak ditemukan, sudah terdaftar resmi, atau bukan milik Anda.';
  END IF;

  UPDATE public.kunjungan
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = _kunjungan_id;

  PERFORM public.log_audit(auth.uid(), 'delete', 'kunjungan', _kunjungan_id, _puskesmas_id,
    'Keluarga menghapus pengajuan kunjungan (belum terdaftar resmi)', '{}'::jsonb);
END $$;

-- GRANT EXECUTE sudah diberikan di migrasi sebelumnya (fase 1 & fase 3.3) dan
-- tidak hilang saat CREATE OR REPLACE FUNCTION — tidak perlu diulang di sini.
