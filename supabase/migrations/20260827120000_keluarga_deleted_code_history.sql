-- Keep a durable deletion counter per original keluarga code.
-- This survives hard deletion of DEL rows, so the next deletion is always DELn+1.
CREATE TABLE IF NOT EXISTS public.keluarga_deleted_code_history (
  keluarga_code TEXT PRIMARY KEY,
  last_deleted_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Convert legacy DEL-KODE rows and seed their counters before new deletes use DELn-KODE.
INSERT INTO public.keluarga_deleted_code_history (keluarga_code, last_deleted_number)
SELECT regexp_replace(keluarga_code, '^DEL-', ''), 1
FROM public.keluarga
WHERE keluarga_code LIKE 'DEL-%'
ON CONFLICT (keluarga_code) DO NOTHING;

-- Legacy archived rows may still be marked registered. This migration only
-- normalizes their archive code, so bypass the application update guard here.
ALTER TABLE public.keluarga DISABLE TRIGGER keluarga_block_registered;

UPDATE public.keluarga
SET keluarga_code = 'DEL1-' || regexp_replace(keluarga_code, '^DEL-', '')
WHERE keluarga_code LIKE 'DEL-%';

ALTER TABLE public.keluarga ENABLE TRIGGER keluarga_block_registered;

CREATE OR REPLACE FUNCTION public.assign_deleted_keluarga_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original_code TEXT;
  next_number INTEGER;
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
     AND NEW.keluarga_code !~ '^DEL[0-9]+-' THEN
    original_code := NEW.keluarga_code;

    INSERT INTO public.keluarga_deleted_code_history (keluarga_code, last_deleted_number)
    VALUES (original_code, 1)
    ON CONFLICT (keluarga_code) DO UPDATE
      SET last_deleted_number = keluarga_deleted_code_history.last_deleted_number + 1,
          updated_at = now()
    RETURNING last_deleted_number INTO next_number;

    NEW.keluarga_code := 'DEL' || next_number::TEXT || '-' || original_code;
    NEW.user_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keluarga_assign_deleted_code ON public.keluarga;
CREATE TRIGGER keluarga_assign_deleted_code
BEFORE UPDATE OF deleted_at ON public.keluarga
FOR EACH ROW
EXECUTE FUNCTION public.assign_deleted_keluarga_code();

ALTER TABLE public.keluarga_deleted_code_history ENABLE ROW LEVEL SECURITY;