-- Enums
CREATE TYPE public.status_keluarga AS ENUM ('aktif','nonaktif','pindah','meninggal');
CREATE TYPE public.hubungan_keluarga AS ENUM ('Kepala Keluarga','Istri','Anak','Orang Tua','Lainnya');
CREATE TYPE public.jenis_kelamin AS ENUM ('L','P');

-- Sequence for keluarga_code numbering
CREATE SEQUENCE public.keluarga_code_seq START 1;

-- Helper: generate keluarga_code from puskesmas name + sequence
CREATE OR REPLACE FUNCTION public.generate_keluarga_code(_puskesmas_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix text;
  _seq bigint;
  _nama text;
BEGIN
  SELECT nama_puskesmas INTO _nama FROM public.puskesmas WHERE id = _puskesmas_id;
  IF _nama IS NULL THEN
    _prefix := 'UMM';
  ELSE
    _prefix := upper(regexp_replace(substr(_nama, 1, 3), '[^A-Za-z]', 'X', 'g'));
  END IF;
  _seq := nextval('public.keluarga_code_seq');
  RETURN 'KLG-' || _prefix || '-' || lpad(_seq::text, 4, '0');
END;
$$;

-- Table keluarga
CREATE TABLE public.keluarga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keluarga_code text UNIQUE NOT NULL,
  nomor_kk text NOT NULL,
  kepala_keluarga text NOT NULL,
  nik text NOT NULL,
  alamat text,
  telepon text,
  status public.status_keluarga NOT NULL DEFAULT 'aktif',
  puskesmas_id uuid NOT NULL REFERENCES public.puskesmas(id) ON DELETE RESTRICT,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT keluarga_nomor_kk_format CHECK (nomor_kk ~ '^[0-9]{16}$'),
  CONSTRAINT keluarga_nik_format CHECK (nik ~ '^[0-9]{16}$')
);

CREATE UNIQUE INDEX keluarga_nomor_kk_unique ON public.keluarga(nomor_kk) WHERE deleted_at IS NULL;
CREATE INDEX keluarga_puskesmas_idx ON public.keluarga(puskesmas_id) WHERE deleted_at IS NULL;
CREATE INDEX keluarga_status_idx ON public.keluarga(status) WHERE deleted_at IS NULL;
CREATE INDEX keluarga_kepala_idx ON public.keluarga(lower(kepala_keluarga)) WHERE deleted_at IS NULL;

-- Auto-generate keluarga_code & maintain updated_at
CREATE OR REPLACE FUNCTION public.keluarga_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.keluarga_code IS NULL OR NEW.keluarga_code = '' THEN
    NEW.keluarga_code := public.generate_keluarga_code(NEW.puskesmas_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER keluarga_set_code
BEFORE INSERT ON public.keluarga
FOR EACH ROW EXECUTE FUNCTION public.keluarga_before_insert();

CREATE TRIGGER keluarga_set_updated
BEFORE UPDATE ON public.keluarga
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Table anggota_keluarga
CREATE TABLE public.anggota_keluarga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keluarga_id uuid NOT NULL REFERENCES public.keluarga(id) ON DELETE CASCADE,
  nama text NOT NULL,
  nik text,
  hubungan public.hubungan_keluarga NOT NULL,
  tanggal_lahir date,
  jenis_kelamin public.jenis_kelamin,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT anggota_nik_format CHECK (nik IS NULL OR nik ~ '^[0-9]{16}$')
);

CREATE INDEX anggota_keluarga_idx ON public.anggota_keluarga(keluarga_id) WHERE deleted_at IS NULL;
CREATE INDEX anggota_nama_idx ON public.anggota_keluarga(lower(nama)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX anggota_nik_unique ON public.anggota_keluarga(nik) WHERE deleted_at IS NULL AND nik IS NOT NULL;

CREATE TRIGGER anggota_set_updated
BEFORE UPDATE ON public.anggota_keluarga
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.keluarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anggota_keluarga ENABLE ROW LEVEL SECURITY;

-- Helper: check user has access to keluarga row (by puskesmas scope or keluarga owner)
-- Reuses get_user_puskesmas_id() and has_role().

-- keluarga policies
CREATE POLICY keluarga_dinkes_all ON public.keluarga FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_dinkes'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_dinkes'));

CREATE POLICY keluarga_puskesmas_select ON public.keluarga FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin_puskesmas') OR public.has_role(auth.uid(), 'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );

CREATE POLICY keluarga_puskesmas_insert ON public.keluarga FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin_puskesmas') OR public.has_role(auth.uid(), 'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );

CREATE POLICY keluarga_puskesmas_update ON public.keluarga FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin_puskesmas') OR public.has_role(auth.uid(), 'perawat'))
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );

CREATE POLICY keluarga_self_select ON public.keluarga FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'keluarga')
    AND created_by = auth.uid()
  );

-- anggota policies (scoped via parent keluarga)
CREATE POLICY anggota_dinkes_all ON public.anggota_keluarga FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_dinkes'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_dinkes'));

CREATE POLICY anggota_puskesmas_select ON public.anggota_keluarga FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.keluarga k
      WHERE k.id = anggota_keluarga.keluarga_id
        AND (public.has_role(auth.uid(), 'admin_puskesmas') OR public.has_role(auth.uid(), 'perawat'))
        AND k.puskesmas_id = public.get_user_puskesmas_id(auth.uid())
    )
  );

CREATE POLICY anggota_puskesmas_write ON public.anggota_keluarga FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.keluarga k
      WHERE k.id = anggota_keluarga.keluarga_id
        AND (public.has_role(auth.uid(), 'admin_puskesmas') OR public.has_role(auth.uid(), 'perawat'))
        AND k.puskesmas_id = public.get_user_puskesmas_id(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.keluarga k
      WHERE k.id = anggota_keluarga.keluarga_id
        AND (public.has_role(auth.uid(), 'admin_puskesmas') OR public.has_role(auth.uid(), 'perawat'))
        AND k.puskesmas_id = public.get_user_puskesmas_id(auth.uid())
    )
  );

CREATE POLICY anggota_self_select ON public.anggota_keluarga FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.keluarga k
      WHERE k.id = anggota_keluarga.keluarga_id
        AND public.has_role(auth.uid(), 'keluarga')
        AND k.created_by = auth.uid()
    )
  );