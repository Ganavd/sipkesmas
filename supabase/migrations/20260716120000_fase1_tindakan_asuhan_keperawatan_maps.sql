-- =====================================================================
-- FASE 1 — Rebuild SIPKESMAS: sumbu Tindakan, Asuhan Keperawatan, Maps Puskesmas
-- Rujukan: sipkesmas-rencana-revisi.md (alur/UX) & sipkesmas-rencana-teknis.md (teknis)
-- Catatan: data existing tidak kritis (sudah dikonfirmasi user), migrasi ditulis
-- langsung tanpa dual-write, tapi tetap idempotent (aman dijalankan ulang).
-- =====================================================================

-- ---------- 1. Enum tindakan_kunjungan (baru) ----------
DO $$ BEGIN
  CREATE TYPE public.tindakan_kunjungan AS ENUM ('pengajuan', 'disetujui', 'selesai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 2. Kolom baru di kunjungan ----------
ALTER TABLE public.kunjungan
  ADD COLUMN IF NOT EXISTS tindakan public.tindakan_kunjungan NOT NULL DEFAULT 'pengajuan',
  ADD COLUMN IF NOT EXISTS perihal TEXT,
  ADD COLUMN IF NOT EXISTS mobil TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pesan_tindak_lanjut TEXT;

CREATE INDEX IF NOT EXISTS idx_kunjungan_tindakan ON public.kunjungan(tindakan);

COMMENT ON COLUMN public.kunjungan.tindakan IS
  'Sumbu Tindakan (terpisah dari is_registered/Status): pengajuan -> disetujui -> selesai';

-- "Tanggal & jam dibuat" = created_at, "Tanggal & jam diubah" = updated_at (sudah ada,
-- tidak perlu kolom baru). PENTING: updated_at cuma boleh ke-bump pas ADA perubahan nyata
-- -- ini tanggung jawab application layer (Fase 3): jangan panggil .update() kalau tidak
-- ada field yang benar-benar berubah, karena trigger handle_updated_at() men-set updated_at
-- di SETIAP UPDATE yang jalan, tanpa cek diff.

-- ---------- 3. Tabel kunjungan_tim (Tim Kunjungan, multi-pilih perawat) ----------
CREATE TABLE IF NOT EXISTS public.kunjungan_tim (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunjungan_id UUID NOT NULL REFERENCES public.kunjungan(id) ON DELETE CASCADE,
  perawat_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kunjungan_id, perawat_id)
);

CREATE INDEX IF NOT EXISTS idx_kunjungan_tim_kunjungan ON public.kunjungan_tim(kunjungan_id);

ALTER TABLE public.kunjungan_tim ENABLE ROW LEVEL SECURITY;

CREATE POLICY kunjungan_tim_select ON public.kunjungan_tim
  FOR SELECT TO authenticated USING (true);

CREATE POLICY kunjungan_tim_write_admin ON public.kunjungan_tim
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin_dinkes'::app_role)
    OR public.has_role(auth.uid(), 'admin_puskesmas'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin_dinkes'::app_role)
    OR public.has_role(auth.uid(), 'admin_puskesmas'::app_role)
  );

-- PENTING: project ini pakai GRANT snapshot ("ON ALL TABLES IN SCHEMA public"),
-- bukan ALTER DEFAULT PRIVILEGES — jadi tabel baru TIDAK otomatis dapat grant,
-- harus ditambahkan manual di sini (lihat supabase/migrations/20260618000001_manual_fixes_and_grants.sql).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kunjungan_tim TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.kunjungan_tim TO service_role;

-- ---------- 4. Pangkas jenis_kunjungan: buang 'kontrol' (rencana baru cuma 3 opsi) ----------
UPDATE public.kunjungan SET jenis_kunjungan = 'rumah' WHERE jenis_kunjungan = 'kontrol';

ALTER TYPE public.jenis_kunjungan RENAME TO jenis_kunjungan_old;
CREATE TYPE public.jenis_kunjungan AS ENUM ('rumah', 'puskesmas', 'darurat');

ALTER TABLE public.kunjungan
  ALTER COLUMN jenis_kunjungan DROP DEFAULT,
  ALTER COLUMN jenis_kunjungan TYPE public.jenis_kunjungan
    USING jenis_kunjungan::text::public.jenis_kunjungan,
  ALTER COLUMN jenis_kunjungan SET DEFAULT 'rumah';

DROP TYPE public.jenis_kunjungan_old;

-- ---------- 5. Tabel asuhan_keperawatan (baru) ----------
CREATE TABLE IF NOT EXISTS public.asuhan_keperawatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunjungan_id UUID NOT NULL REFERENCES public.kunjungan(id),
  pengkajian TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  rencana_intervensi TEXT NOT NULL,
  implementasi TEXT NOT NULL,
  evaluasi_s TEXT,
  evaluasi_o TEXT,
  evaluasi_a TEXT,
  evaluasi_p TEXT,
  petugas_id UUID NOT NULL REFERENCES public.profiles(id),
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asuhan_kunjungan ON public.asuhan_keperawatan(kunjungan_id);

DROP TRIGGER IF EXISTS trg_asuhan_updated_at ON public.asuhan_keperawatan;
CREATE TRIGGER trg_asuhan_updated_at
  BEFORE UPDATE ON public.asuhan_keperawatan
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Kunci otomatis: cuma bisa diubah/dihapus di hari kalender yang sama saat dibuat
-- (aturan: "dibuat Senin 10:00 -> terkunci otomatis mulai Selasa 00:00")
CREATE OR REPLACE FUNCTION public.asuhan_keperawatan_lock_after_day()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF date_trunc('day', OLD.created_at) < date_trunc('day', now()) THEN
    RAISE EXCEPTION 'Asuhan keperawatan sudah lewat hari pembuatan, terkunci (hanya bisa dilihat).';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS trg_asuhan_lock ON public.asuhan_keperawatan;
CREATE TRIGGER trg_asuhan_lock
  BEFORE UPDATE OR DELETE ON public.asuhan_keperawatan
  FOR EACH ROW EXECUTE FUNCTION public.asuhan_keperawatan_lock_after_day();

-- Cuma boleh bikin Asuhan Keperawatan untuk kunjungan yang tindakannya sudah 'disetujui'
-- (tindak lanjut tahap 1 harus selesai dulu)
CREATE OR REPLACE FUNCTION public.asuhan_keperawatan_validate_kunjungan()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _tindakan public.tindakan_kunjungan;
BEGIN
  SELECT tindakan INTO _tindakan FROM public.kunjungan WHERE id = NEW.kunjungan_id;
  IF _tindakan IS DISTINCT FROM 'disetujui' THEN
    RAISE EXCEPTION 'Asuhan Keperawatan hanya bisa dibuat untuk kunjungan yang tindakannya sudah Disetujui.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_asuhan_validate_kunjungan ON public.asuhan_keperawatan;
CREATE TRIGGER trg_asuhan_validate_kunjungan
  BEFORE INSERT ON public.asuhan_keperawatan
  FOR EACH ROW EXECUTE FUNCTION public.asuhan_keperawatan_validate_kunjungan();

-- Begitu asuhan keperawatan pertama disimpan untuk 1 kunjungan -> tindakan kunjungan
-- otomatis jadi 'selesai' (tindak lanjut tahap 2). Dipakai flag session lokal
-- (bukan SECURITY DEFINER) supaya trigger kunjungan_block_when_registered tahu ini
-- transisi sistem, bukan Perawat langsung mengedit kunjungan yang sudah terdaftar
-- (soalnya Perawat semestinya sudah terkunci begitu status Terdaftar).
CREATE OR REPLACE FUNCTION public.asuhan_keperawatan_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _puskesmas_id uuid;
BEGIN
  PERFORM set_config('sipkesmas.system_transition', 'true', true);

  UPDATE public.kunjungan SET tindakan = 'selesai'
  WHERE id = NEW.kunjungan_id
  RETURNING puskesmas_id INTO _puskesmas_id;

  PERFORM set_config('sipkesmas.system_transition', 'false', true);

  PERFORM public.log_audit(auth.uid(), 'selesai', 'kunjungan', NEW.kunjungan_id, _puskesmas_id,
    'Asuhan keperawatan disimpan, tindakan otomatis menjadi Selesai', '{}'::jsonb);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_asuhan_after_insert ON public.asuhan_keperawatan;
CREATE TRIGGER trg_asuhan_after_insert
  AFTER INSERT ON public.asuhan_keperawatan
  FOR EACH ROW EXECUTE FUNCTION public.asuhan_keperawatan_after_insert();

ALTER TABLE public.asuhan_keperawatan ENABLE ROW LEVEL SECURITY;

CREATE POLICY asuhan_select ON public.asuhan_keperawatan
  FOR SELECT TO authenticated USING (true);

CREATE POLICY asuhan_insert_perawat ON public.asuhan_keperawatan
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'perawat'::app_role));

CREATE POLICY asuhan_update_perawat ON public.asuhan_keperawatan
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'perawat'::app_role));

CREATE POLICY asuhan_delete_perawat ON public.asuhan_keperawatan
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'perawat'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.asuhan_keperawatan TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.asuhan_keperawatan TO service_role;

-- ---------- 6. Kolom peta di puskesmas (link Maps -> lat/lng + alamat gabungan) ----------
ALTER TABLE public.puskesmas
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS maps_link TEXT;

-- kolom `alamat` yang sudah ada dipertahankan, isinya nanti diisi hasil geocoding
-- (1 blok teks gabungan), bukan input manual lagi. kecamatan/kabupaten dibiarkan
-- ada (tidak dipakai form baru, tidak perlu buru-buru dihapus).

-- ---------- 7. Revisi hak edit/hapus kunjungan (ganti trigger lama) ----------
-- Lama: begitu is_registered=true, cuma admin_dinkes yang boleh ubah/hapus.
-- Baru:
--   - tindakan = 'selesai'  -> terkunci total, semua role hanya bisa Lihat
--   - is_registered = true  -> hanya admin_dinkes & admin_puskesmas yang masih boleh
--                              ubah/hapus (perawat otomatis terkunci jadi Lihat saja
--                              begitu status resmi Terdaftar)
--   - masih draft           -> admin_dinkes, admin_puskesmas, perawat semua boleh
--                              (diatur oleh RLS policy yang sudah ada, trigger ini
--                              tidak menghalangi)
CREATE OR REPLACE FUNCTION public.kunjungan_block_when_registered()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Dilewati kalau ini transisi otomatis dari sistem (misal: Asuhan Keperawatan
  -- tersimpan -> tindakan jadi Selesai), bukan Perawat/user langsung mengedit.
  IF current_setting('sipkesmas.system_transition', true) = 'true' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF OLD.tindakan = 'selesai' THEN
    RAISE EXCEPTION 'Kunjungan dengan tindakan Selesai tidak dapat diubah/dihapus lagi.';
  END IF;

  IF OLD.is_registered AND NOT (
    public.has_role(auth.uid(), 'admin_dinkes'::app_role)
    OR public.has_role(auth.uid(), 'admin_puskesmas'::app_role)
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Kunjungan terdaftar hanya bisa dihapus oleh Admin Puskesmas/Dinkes.';
    END IF;
    RAISE EXCEPTION 'Kunjungan terdaftar hanya bisa diubah oleh Admin Puskesmas/Dinkes.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
-- trigger kunjungan_block_registered sudah ada dan menunjuk ke function ini,
-- CREATE OR REPLACE di atas otomatis kepakai tanpa perlu bikin trigger baru.

-- RLS lama cuma punya SELECT/INSERT/UPDATE untuk admin_puskesmas & perawat, belum
-- ada DELETE sama sekali selain admin_dinkes (FOR ALL). Ditambah di sini supaya
-- Admin Puskesmas & Perawat bisa Hapus sesuai rencana (batasnya tetap dijaga trigger
-- di atas + kolom tindakan).
CREATE POLICY kunjungan_puskesmas_delete ON public.kunjungan
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin_puskesmas'::app_role) OR public.has_role(auth.uid(), 'perawat'::app_role))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );

-- ---------- 8. Nonaktifkan auto-register-by-timeout khusus kunjungan ----------
-- Status kunjungan sekarang HANYA berubah lewat aksi eksplisit Keluarga ("Ajukan
-- Resmi"), bukan lagi otomatis lewat draft_expires_at. Keluarga tetap dipertahankan
-- apa adanya (di luar cakupan Fase 1 ini).
CREATE OR REPLACE FUNCTION public.auto_register_expired_drafts()
RETURNS TABLE(keluarga_count int, kunjungan_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _k int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.keluarga SET is_registered = true, workflow_status = 'registered', registered_at = now()
    WHERE is_registered = false AND draft_expires_at < now() RETURNING 1
  ) SELECT count(*)::int INTO _k FROM upd;

  -- kunjungan sengaja TIDAK lagi di-auto-register di sini, lihat catatan di atas.
  RETURN QUERY SELECT _k, 0;
END $$;

-- ---------- 9. RPC: Keluarga "Ajukan Resmi" (satu-satunya cara is_registered berubah) ----------
-- RLS kunjungan saat ini tidak memberi Keluarga hak UPDATE sama sekali (cuma
-- SELECT). Daripada buka UPDATE policy lebar buat role keluarga (yang bisa dipakai
-- ubah kolom lain juga), dipakai RPC sempit yang cuma mengizinkan satu transisi ini.
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
    WHERE kj.id = _kunjungan_id AND k.created_by = auth.uid() AND kj.is_registered = false
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

REVOKE ALL ON FUNCTION public.kunjungan_ajukan_resmi(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kunjungan_ajukan_resmi(uuid) TO authenticated;
