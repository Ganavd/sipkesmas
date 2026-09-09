
ALTER TABLE public.keluarga
  ADD COLUMN IF NOT EXISTS workflow_status public.workflow_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS registered_by uuid,
  ADD COLUMN IF NOT EXISTS draft_expires_at timestamptz NOT NULL DEFAULT (date_trunc('day', now()) + interval '1 day'),
  ADD COLUMN IF NOT EXISTS workflow_note text;

ALTER TABLE public.kunjungan
  ADD COLUMN IF NOT EXISTS workflow_status public.workflow_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS registered_by uuid,
  ADD COLUMN IF NOT EXISTS draft_expires_at timestamptz NOT NULL DEFAULT (date_trunc('day', now()) + interval '1 day'),
  ADD COLUMN IF NOT EXISTS workflow_note text;

UPDATE public.keluarga
SET is_registered = true, workflow_status = 'registered',
    registered_at = COALESCE(registered_at, created_at)
WHERE is_registered = false AND created_at < now() - interval '1 minute';

UPDATE public.kunjungan
SET is_registered = true, workflow_status = 'registered',
    registered_at = COALESCE(registered_at, created_at)
WHERE is_registered = false AND created_at < now() - interval '1 minute';

CREATE INDEX IF NOT EXISTS idx_keluarga_workflow ON public.keluarga(workflow_status, is_registered);
CREATE INDEX IF NOT EXISTS idx_kunjungan_workflow ON public.kunjungan(workflow_status, is_registered);
CREATE INDEX IF NOT EXISTS idx_keluarga_draft_expires ON public.keluarga(draft_expires_at) WHERE is_registered = false;
CREATE INDEX IF NOT EXISTS idx_kunjungan_draft_expires ON public.kunjungan(draft_expires_at) WHERE is_registered = false;

CREATE OR REPLACE FUNCTION public.keluarga_block_when_registered()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_registered AND NOT public.has_role(auth.uid(), 'admin_dinkes'::app_role) THEN
      RAISE EXCEPTION 'Data keluarga terdaftar tidak dapat dihapus (hanya Admin Dinkes).';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_registered AND NOT public.has_role(auth.uid(), 'admin_dinkes'::app_role) THEN
    RAISE EXCEPTION 'Data keluarga terdaftar tidak dapat diubah (hanya Admin Dinkes).';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS keluarga_block_registered ON public.keluarga;
CREATE TRIGGER keluarga_block_registered BEFORE UPDATE OR DELETE ON public.keluarga
  FOR EACH ROW EXECUTE FUNCTION public.keluarga_block_when_registered();

CREATE OR REPLACE FUNCTION public.kunjungan_block_when_registered()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_registered AND NOT public.has_role(auth.uid(), 'admin_dinkes'::app_role) THEN
      RAISE EXCEPTION 'Data kunjungan terdaftar tidak dapat dihapus (hanya Admin Dinkes).';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_registered AND NOT public.has_role(auth.uid(), 'admin_dinkes'::app_role) THEN
    RAISE EXCEPTION 'Data kunjungan terdaftar tidak dapat diubah (hanya Admin Dinkes).';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kunjungan_block_registered ON public.kunjungan;
CREATE TRIGGER kunjungan_block_registered BEFORE UPDATE OR DELETE ON public.kunjungan
  FOR EACH ROW EXECUTE FUNCTION public.kunjungan_block_when_registered();

CREATE OR REPLACE FUNCTION public.generate_entity_code_v2(_puskesmas_id uuid, _seq_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _kode TEXT; _seq BIGINT;
BEGIN
  SELECT kode INTO _kode FROM public.puskesmas WHERE id = _puskesmas_id;
  IF _kode IS NULL THEN _kode := 'UMM'; END IF;
  EXECUTE format('SELECT nextval(%L)', 'public.' || _seq_name) INTO _seq;
  RETURN _kode || '-' || lpad(_seq::text, 4, '0');
END $$;
REVOKE ALL ON FUNCTION public.generate_entity_code_v2(uuid, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.keluarga_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.keluarga_code IS NULL OR NEW.keluarga_code = '' THEN
    NEW.keluarga_code := public.generate_entity_code_v2(NEW.puskesmas_id, 'keluarga_code_seq');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kunjungan_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kunjungan_code IS NULL OR NEW.kunjungan_code = '' THEN
    NEW.kunjungan_code := public.generate_entity_code_v2(NEW.puskesmas_id, 'kunjungan_code_seq');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_keluarga_before_insert ON public.keluarga;
CREATE TRIGGER trg_keluarga_before_insert BEFORE INSERT ON public.keluarga
  FOR EACH ROW EXECUTE FUNCTION public.keluarga_before_insert();

DROP TRIGGER IF EXISTS trg_kunjungan_before_insert ON public.kunjungan;
CREATE TRIGGER trg_kunjungan_before_insert BEFORE INSERT ON public.kunjungan
  FOR EACH ROW EXECUTE FUNCTION public.kunjungan_before_insert();

CREATE OR REPLACE FUNCTION public.auto_register_expired_drafts()
RETURNS TABLE(keluarga_count int, kunjungan_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _k int := 0; _u int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.keluarga SET is_registered = true, workflow_status = 'registered', registered_at = now()
    WHERE is_registered = false AND draft_expires_at < now() RETURNING 1
  ) SELECT count(*)::int INTO _k FROM upd;

  WITH upd AS (
    UPDATE public.kunjungan SET is_registered = true, workflow_status = 'registered', registered_at = now()
    WHERE is_registered = false AND draft_expires_at < now() RETURNING 1
  ) SELECT count(*)::int INTO _u FROM upd;

  RETURN QUERY SELECT _k, _u;
END $$;

REVOKE ALL ON FUNCTION public.auto_register_expired_drafts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_register_expired_drafts() TO service_role;
