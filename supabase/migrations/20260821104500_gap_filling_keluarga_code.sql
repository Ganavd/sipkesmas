-- Modify generate_keluarga_code to fill gaps without KLG- and prevent race conditions
CREATE OR REPLACE FUNCTION public.generate_keluarga_code(_puskesmas_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kode TEXT;
  _next_val INT := 1;
  _existing_code TEXT;
BEGIN
  -- We lock the puskesmas row so concurrent family creations wait and don't generate duplicates
  SELECT kode INTO _kode FROM public.puskesmas WHERE id = _puskesmas_id FOR UPDATE;
  IF _kode IS NULL THEN _kode := 'UMM'; END IF;
  
  -- Gap filling logic for this specific puskesmas
  -- We look for the first number starting from 1 that doesn't exist
  LOOP
    _existing_code := _kode || '-' || lpad(_next_val::text, 4, '0');
    IF NOT EXISTS (SELECT 1 FROM public.keluarga WHERE keluarga_code = _existing_code) THEN
      EXIT;
    END IF;
    _next_val := _next_val + 1;
  END LOOP;

  RETURN _kode || '-' || lpad(_next_val::text, 4, '0');
END;
$$;
