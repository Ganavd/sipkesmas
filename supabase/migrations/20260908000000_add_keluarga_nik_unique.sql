DROP INDEX IF EXISTS public.keluarga_nomor_kk_unique;
CREATE UNIQUE INDEX keluarga_nomor_kk_unique
  ON public.keluarga(nomor_kk)
  WHERE deleted_at IS NULL AND status = 'aktif';

CREATE UNIQUE INDEX IF NOT EXISTS keluarga_nik_unique
  ON public.keluarga(nik)
  WHERE deleted_at IS NULL AND status = 'aktif';