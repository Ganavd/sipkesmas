-- Admin Dinkes and Admin Puskesmas may remove a family and its related visits.
-- Keep the completed-visit restriction for ordinary operational edits/deletes.
CREATE
OR REPLACE FUNCTION public.kunjungan_block_when_registered () RETURNS TRIGGER LANGUAGE plpgsql
SET
    search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin_dinkes'::app_role)
     OR public.has_role(auth.uid(), 'admin_puskesmas'::app_role) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF OLD.tindakan = 'selesai' THEN
    RAISE EXCEPTION 'Kunjungan dengan tindakan Selesai tidak dapat diubah/dihapus lagi.';
  END IF;

  IF OLD.is_registered THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Kunjungan terdaftar hanya bisa dihapus oleh Admin Puskesmas/Dinkes.';
    END IF;
    RAISE EXCEPTION 'Kunjungan terdaftar hanya bisa diubah oleh Admin Puskesmas/Dinkes.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Ensure the family trigger permits archiving by either administrator role,
-- while permanent DELETE remains restricted to Admin Dinkes.
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