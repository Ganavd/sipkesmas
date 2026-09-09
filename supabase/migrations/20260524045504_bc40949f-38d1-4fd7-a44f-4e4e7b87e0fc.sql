
-- Trigger: notify on register / override for keluarga and kunjungan
CREATE OR REPLACE FUNCTION public.notify_workflow_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity text := TG_TABLE_NAME;
  _code text;
  _puskesmas uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  IF _entity = 'keluarga' THEN
    _code := NEW.keluarga_code;
    _puskesmas := NEW.puskesmas_id;
  ELSIF _entity = 'kunjungan' THEN
    _code := NEW.kunjungan_code;
    _puskesmas := NEW.puskesmas_id;
  ELSE
    RETURN NEW;
  END IF;

  -- Registered transition (draft -> registered)
  IF (OLD.is_registered IS DISTINCT FROM NEW.is_registered) AND NEW.is_registered THEN
    INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
    VALUES (
      'sistem'::notification_type,
      'admin_puskesmas'::app_role,
      _entity,
      NEW.id,
      'Data ' || _entity || ' terdaftar',
      _code || ' kini menjadi data resmi.',
      _puskesmas
    );
  END IF;

  -- Override on already-registered with workflow_note change
  IF NEW.is_registered AND OLD.is_registered
     AND (OLD.workflow_note IS DISTINCT FROM NEW.workflow_note)
     AND NEW.workflow_note IS NOT NULL THEN
    INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
    VALUES (
      'sistem'::notification_type,
      'admin_dinkes'::app_role,
      _entity,
      NEW.id,
      'Override data ' || _entity,
      _code || ' diperbarui dengan catatan workflow.',
      _puskesmas
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS keluarga_notify_workflow ON public.keluarga;
CREATE TRIGGER keluarga_notify_workflow
AFTER UPDATE ON public.keluarga
FOR EACH ROW EXECUTE FUNCTION public.notify_workflow_event();

DROP TRIGGER IF EXISTS kunjungan_notify_workflow ON public.kunjungan;
CREATE TRIGGER kunjungan_notify_workflow
AFTER UPDATE ON public.kunjungan
FOR EACH ROW EXECUTE FUNCTION public.notify_workflow_event();
