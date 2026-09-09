-- Ensure inserts that omit keluarga_code also use the gap-filling generator.
-- Archived DELn-KODE rows do not occupy their original active code.
CREATE OR REPLACE FUNCTION public.keluarga_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.keluarga_code IS NULL OR NEW.keluarga_code = '' THEN
    NEW.keluarga_code := public.generate_keluarga_code(NEW.puskesmas_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_keluarga_before_insert ON public.keluarga;
CREATE TRIGGER trg_keluarga_before_insert
BEFORE INSERT ON public.keluarga
FOR EACH ROW
EXECUTE FUNCTION public.keluarga_before_insert();