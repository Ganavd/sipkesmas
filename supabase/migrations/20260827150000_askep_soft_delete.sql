ALTER TABLE public.asuhan_keperawatan
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles (id);

CREATE INDEX IF NOT EXISTS idx_asuhan_deleted_at ON public.asuhan_keperawatan (deleted_at);

CREATE
OR REPLACE FUNCTION public.asuhan_keperawatan_lock_after_day () RETURNS TRIGGER LANGUAGE plpgsql
SET
    search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin_dinkes'::app_role) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF date_trunc('day', OLD.created_at) < date_trunc('day', now()) THEN
    RAISE EXCEPTION 'Asuhan keperawatan sudah lewat hari pembuatan, terkunci (hanya bisa dilihat).';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;