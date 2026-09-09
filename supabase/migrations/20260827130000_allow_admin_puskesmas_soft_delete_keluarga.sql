-- Admin Puskesmas may archive families in their own puskesmas.
-- Permanent deletion remains restricted to Admin Dinkes in the DELETE branch.
CREATE
OR REPLACE FUNCTION public.keluarga_block_when_registered () RETURNS TRIGGER LANGUAGE plpgsql
SET
    search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_registered
       AND NOT public.has_role(auth.uid(), 'admin_dinkes'::app_role) THEN
      RAISE EXCEPTION 'Data keluarga terdaftar tidak dapat dihapus permanen (hanya Admin Dinkes).';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_registered
     AND NOT (
       public.has_role(auth.uid(), 'admin_dinkes'::app_role)
       OR public.has_role(auth.uid(), 'admin_puskesmas'::app_role)
     ) THEN
    RAISE EXCEPTION 'Data keluarga terdaftar hanya dapat diubah oleh Admin Puskesmas/Dinkes.';
  END IF;

  RETURN NEW;
END;
$$;