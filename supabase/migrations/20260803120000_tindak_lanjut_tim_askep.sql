-- Migration: 20260803120000_tindak_lanjut_tim_askep.sql
-- Deskripsi: Penambahan tabel tim_kunjungan, kolom TL1, RLS Askep, dan ENUM tindakan_kunjungan

-- ============================================================================
-- 1. TABEL tim_kunjungan (Master Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tim_kunjungan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    puskesmas_id UUID NOT NULL REFERENCES public.puskesmas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status_aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT tim_kunjungan_puskesmas_user_key UNIQUE (puskesmas_id, user_id)
);

-- Aktifkan RLS
ALTER TABLE public.tim_kunjungan ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama agar tidak berbentrokan
DROP POLICY IF EXISTS "Admin dapat mengelola tim_kunjungan" ON public.tim_kunjungan;
DROP POLICY IF EXISTS "Semua role dapat melihat tim_kunjungan" ON public.tim_kunjungan;

-- RLS: Admin Dinkes (Akses Global) & Admin PKM (Akses sesuai Puskesmas)
CREATE POLICY "Admin dapat mengelola tim_kunjungan" ON public.tim_kunjungan
  FOR ALL
  USING (
    public.get_user_role(auth.uid()) = 'admin_dinkes'
    OR (
      public.get_user_role(auth.uid()) = 'admin_puskesmas'
      AND public.get_user_puskesmas_id(auth.uid()) = puskesmas_id
    )
  );

CREATE POLICY "Semua role dapat melihat tim_kunjungan" ON public.tim_kunjungan
  FOR SELECT
  USING (
    public.get_user_role(auth.uid()) = 'admin_dinkes'
    OR public.get_user_puskesmas_id(auth.uid()) = puskesmas_id
  );

-- Auto-update kolom updated_at jika fungsi handle_updated_at tersedia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_tim_kunjungan_updated_at ON public.tim_kunjungan;
    CREATE TRIGGER trg_tim_kunjungan_updated_at
      BEFORE UPDATE ON public.tim_kunjungan
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 2. PENAMBAHAN KOLOM PADA TABEL kunjungan (Tindak Lanjut 1)
-- ============================================================================
ALTER TABLE public.kunjungan
  ADD COLUMN IF NOT EXISTS tl1_mobil TEXT[],
  ADD COLUMN IF NOT EXISTS tl1_catatan TEXT;

-- ============================================================================
-- 3. PERBARUI TABEL & RLS asuhan_keperawatan (Askep)
-- ============================================================================
ALTER TABLE public.asuhan_keperawatan
  ADD COLUMN IF NOT EXISTS puskesmas_id UUID REFERENCES public.puskesmas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tanggal TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.asuhan_keperawatan ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama agar tidak duplikat
DROP POLICY IF EXISTS "Perawat mengelola asuhan_keperawatan" ON public.asuhan_keperawatan;
DROP POLICY IF EXISTS "Semua melihat asuhan_keperawatan" ON public.asuhan_keperawatan;

-- RLS Baru
CREATE POLICY "Perawat mengelola asuhan_keperawatan" ON public.asuhan_keperawatan
  FOR ALL
  USING (
    public.get_user_role(auth.uid()) = 'perawat'
    AND public.get_user_puskesmas_id(auth.uid()) = puskesmas_id
  );

CREATE POLICY "Semua melihat asuhan_keperawatan" ON public.asuhan_keperawatan
  FOR SELECT
  USING (
    public.get_user_role(auth.uid()) = 'admin_dinkes'
    OR public.get_user_puskesmas_id(auth.uid()) = puskesmas_id
  );

-- ============================================================================
-- 4. TAMBAH ENUM 'proses' KE tindakan_kunjungan
-- ============================================================================
-- Menggunakan klausa IF NOT EXISTS resmi bawaan PostgreSQL 12+ (tanpa perlengkapan DO block rumit)
ALTER TYPE public.tindakan_kunjungan ADD VALUE IF NOT EXISTS 'proses';