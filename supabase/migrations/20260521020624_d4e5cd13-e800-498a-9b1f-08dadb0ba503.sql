
-- =====================================================================
-- TURN 3 — Modul Kunjungan + fondasi arsitektur future-ready
-- =====================================================================

-- ---------- A.1 Kode Puskesmas ----------
ALTER TABLE public.puskesmas
  ADD COLUMN IF NOT EXISTS kode CHAR(3);

-- Backfill untuk row existing
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  i INT;
BEGIN
  FOR r IN SELECT id, nama_puskesmas FROM public.puskesmas WHERE kode IS NULL LOOP
    base := upper(regexp_replace(coalesce(substr(r.nama_puskesmas, 1, 3),'UMM'), '[^A-Za-z]', 'X', 'g'));
    candidate := base;
    i := 0;
    WHILE EXISTS (SELECT 1 FROM public.puskesmas WHERE kode = candidate) LOOP
      i := i + 1;
      candidate := upper(substr(base, 1, 2)) || chr(64 + ((i % 26) + 1));
    END LOOP;
    UPDATE public.puskesmas SET kode = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.puskesmas
  ALTER COLUMN kode SET NOT NULL;

ALTER TABLE public.puskesmas
  ADD CONSTRAINT puskesmas_kode_unique UNIQUE (kode);

ALTER TABLE public.puskesmas
  ADD CONSTRAINT puskesmas_kode_format CHECK (kode ~ '^[A-Z]{3}$');

-- ---------- A.2 Generator code generik ----------
CREATE SEQUENCE IF NOT EXISTS public.kunjungan_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_entity_code(_prefix TEXT, _puskesmas_id UUID, _seq_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kode TEXT;
  _seq BIGINT;
BEGIN
  SELECT kode INTO _kode FROM public.puskesmas WHERE id = _puskesmas_id;
  IF _kode IS NULL THEN _kode := 'UMM'; END IF;
  EXECUTE format('SELECT nextval(%L)', 'public.' || _seq_name) INTO _seq;
  RETURN _prefix || '-' || _kode || '-' || lpad(_seq::text, 4, '0');
END;
$$;

-- Refactor generate_keluarga_code → pakai puskesmas.kode
CREATE OR REPLACE FUNCTION public.generate_keluarga_code(_puskesmas_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kode TEXT;
  _seq BIGINT;
BEGIN
  SELECT kode INTO _kode FROM public.puskesmas WHERE id = _puskesmas_id;
  IF _kode IS NULL THEN _kode := 'UMM'; END IF;
  _seq := nextval('public.keluarga_code_seq');
  RETURN 'KLG-' || _kode || '-' || lpad(_seq::text, 4, '0');
END;
$$;

-- ---------- A.3 Enums ----------
DO $$ BEGIN
  CREATE TYPE public.status_kunjungan AS ENUM ('draft','diproses','selesai','diverifikasi','dibatalkan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.jenis_kunjungan AS ENUM ('rumah','puskesmas','darurat','kontrol');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('draft_pending','kunjungan_pending','rekam_pending','laporan_pending','sistem');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attachment_entity AS ENUM ('keluarga','kunjungan','rekam_medis','obat','laporan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- A.4 Tabel kunjungan ----------
CREATE TABLE IF NOT EXISTS public.kunjungan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunjungan_code TEXT NOT NULL UNIQUE,
  keluarga_id UUID NOT NULL REFERENCES public.keluarga(id),
  perawat_id UUID REFERENCES public.profiles(id),
  puskesmas_id UUID NOT NULL REFERENCES public.puskesmas(id),
  jenis_kunjungan public.jenis_kunjungan NOT NULL DEFAULT 'rumah',
  status public.status_kunjungan NOT NULL DEFAULT 'draft',
  catatan_awal TEXT,
  tanggal_kunjungan TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  deleted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kunjungan_keluarga ON public.kunjungan(keluarga_id);
CREATE INDEX IF NOT EXISTS idx_kunjungan_puskesmas ON public.kunjungan(puskesmas_id);
CREATE INDEX IF NOT EXISTS idx_kunjungan_perawat ON public.kunjungan(perawat_id);
CREATE INDEX IF NOT EXISTS idx_kunjungan_status ON public.kunjungan(status);
CREATE INDEX IF NOT EXISTS idx_kunjungan_tanggal ON public.kunjungan(tanggal_kunjungan DESC);

-- trigger auto kode kunjungan
CREATE OR REPLACE FUNCTION public.kunjungan_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kunjungan_code IS NULL OR NEW.kunjungan_code = '' THEN
    NEW.kunjungan_code := public.generate_entity_code('KJN', NEW.puskesmas_id, 'kunjungan_code_seq');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_kunjungan_before_insert ON public.kunjungan;
CREATE TRIGGER trg_kunjungan_before_insert
  BEFORE INSERT ON public.kunjungan
  FOR EACH ROW EXECUTE FUNCTION public.kunjungan_before_insert();

DROP TRIGGER IF EXISTS trg_kunjungan_updated_at ON public.kunjungan;
CREATE TRIGGER trg_kunjungan_updated_at
  BEFORE UPDATE ON public.kunjungan
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.kunjungan ENABLE ROW LEVEL SECURITY;

CREATE POLICY kunjungan_dinkes_all ON public.kunjungan
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_dinkes'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_dinkes'));

CREATE POLICY kunjungan_puskesmas_select ON public.kunjungan
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin_puskesmas') OR public.has_role(auth.uid(),'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );

CREATE POLICY kunjungan_puskesmas_insert ON public.kunjungan
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin_puskesmas') OR public.has_role(auth.uid(),'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );

CREATE POLICY kunjungan_puskesmas_update ON public.kunjungan
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin_puskesmas') OR public.has_role(auth.uid(),'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );

CREATE POLICY kunjungan_keluarga_select ON public.kunjungan
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'keluarga') AND EXISTS (
      SELECT 1 FROM public.keluarga k WHERE k.id = kunjungan.keluarga_id AND k.created_by = auth.uid()
    )
  );

-- ---------- A.5 Notifications (architecture-only) ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type public.notification_type NOT NULL,
  target_role public.app_role,
  target_user_id UUID,
  entity TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  body TEXT,
  puskesmas_id UUID REFERENCES public.puskesmas(id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON public.notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON public.notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_puskesmas ON public.notifications(puskesmas_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_dinkes_all ON public.notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin_dinkes'));

CREATE POLICY notif_admin_puskesmas_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin_puskesmas')
    AND (puskesmas_id IS NULL OR puskesmas_id = public.get_user_puskesmas_id(auth.uid()))
  );

CREATE POLICY notif_self_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    target_user_id = auth.uid()
    OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role))
  );

CREATE POLICY notif_self_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid());

-- ---------- A.6 Attachments (architecture-only) ----------
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.attachment_entity NOT NULL,
  entity_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  puskesmas_id UUID REFERENCES public.puskesmas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON public.attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_puskesmas ON public.attachments(puskesmas_id);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attach_dinkes_all ON public.attachments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin_dinkes'))
  WITH CHECK (public.has_role(auth.uid(),'admin_dinkes'));

CREATE POLICY attach_puskesmas_all ON public.attachments
  FOR ALL TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin_puskesmas') OR public.has_role(auth.uid(),'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'admin_puskesmas') OR public.has_role(auth.uid(),'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );

-- ---------- A.7 Activity tracking helper ----------
CREATE OR REPLACE FUNCTION public.touch_user_activity(_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET last_activity_at = now() WHERE id = _user_id;
$$;
