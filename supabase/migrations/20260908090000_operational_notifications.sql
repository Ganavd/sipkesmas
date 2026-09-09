-- Operational notifications for visit workflow and family activity.
-- Notifications are intentionally created in the database so every entry point
-- (server action, trigger, or admin update) produces the same event.
CREATE
OR REPLACE FUNCTION public.notify_workflow_event () RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = public AS $$
DECLARE
  entity_name text := TG_TABLE_NAME;
  entity_code text;
  family_user_id uuid;
  family_name text;
  target_puskesmas uuid;
BEGIN
  IF entity_name = 'keluarga' THEN
    entity_code := NEW.keluarga_code;
    target_puskesmas := NEW.puskesmas_id;
    family_user_id := NEW.user_id;
    family_name := NEW.kepala_keluarga;

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
      VALUES ('sistem'::notification_type, 'admin_dinkes'::app_role, entity_name, NEW.id,
        'Keluarga Baru Saja Ditambahkan',
        coalesce(family_name, entity_code) || ' menunggu pemeriksaan data.', target_puskesmas);
      RETURN NEW;
    END IF;
  ELSIF entity_name = 'kunjungan' THEN
    entity_code := NEW.kunjungan_code;
    target_puskesmas := NEW.puskesmas_id;
    SELECT k.user_id, k.kepala_keluarga
      INTO family_user_id, family_name
      FROM public.keluarga k WHERE k.id = NEW.keluarga_id;

    IF TG_OP = 'INSERT' AND coalesce(NEW.is_registered, false) = false
       AND NEW.tindakan = 'pengajuan' THEN
      IF family_user_id IS NOT NULL THEN
        INSERT INTO public.notifications(notification_type, target_user_id, entity, entity_id, title, body, puskesmas_id)
        VALUES ('sistem'::notification_type, family_user_id, entity_name, NEW.id,
          'Pengajuan Kunjungan Baru Saja Ditambahkan',
          coalesce(entity_code, 'Kunjungan') || ' untuk keluarga Anda telah dibuat.', target_puskesmas);
      END IF;
      INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
      VALUES ('sistem'::notification_type, 'admin_dinkes'::app_role, entity_name, NEW.id,
        'Pengajuan Kunjungan Baru Saja Ditambahkan',
        coalesce(family_name, 'Keluarga') || ' memiliki pengajuan kunjungan baru.', target_puskesmas);
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  IF entity_name = 'keluarga'
     AND OLD.is_registered IS DISTINCT FROM NEW.is_registered
     AND NEW.is_registered THEN
    INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
    VALUES ('sistem'::notification_type, 'admin_puskesmas'::app_role, entity_name, NEW.id,
      'Keluarga Sudah Diajukan Resmi', entity_code || ' kini menjadi data resmi.', target_puskesmas);
    INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
    VALUES ('sistem'::notification_type, 'admin_dinkes'::app_role, entity_name, NEW.id,
      'Keluarga Sudah Diajukan Resmi', entity_code || ' menjadi data resmi.', target_puskesmas);
  END IF;

  IF entity_name = 'kunjungan' THEN
    IF OLD.is_registered IS DISTINCT FROM NEW.is_registered AND NEW.is_registered THEN
      INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
      VALUES ('sistem'::notification_type, 'admin_dinkes'::app_role, entity_name, NEW.id,
        'Kunjungan Keluarga Sudah Diajukan Resmi',
        coalesce(family_name, 'Keluarga') || ' (' || entity_code || ') sudah terdaftar resmi.', target_puskesmas);
    END IF;

    IF OLD.tindakan IS DISTINCT FROM NEW.tindakan AND NEW.tindakan = 'proses' THEN
      INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
      VALUES ('sistem'::notification_type, 'perawat'::app_role, entity_name, NEW.id,
        'Kunjungan Keluarga Sudah di Tindak Lanjut 1',
        coalesce(family_name, 'Keluarga') || ' siap ditindaklanjuti ke tahap berikutnya.', target_puskesmas);
      INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
      VALUES ('sistem'::notification_type, 'admin_dinkes'::app_role, entity_name, NEW.id,
        'Kunjungan Keluarga Sudah di Tindak Lanjut 1',
        coalesce(family_name, 'Keluarga') || ' telah masuk tahap TL1.', target_puskesmas);
    END IF;

    IF OLD.tindakan IS DISTINCT FROM NEW.tindakan AND NEW.tindakan = 'selesai'
       AND family_user_id IS NOT NULL THEN
      INSERT INTO public.notifications(notification_type, target_user_id, entity, entity_id, title, body, puskesmas_id)
      VALUES ('sistem'::notification_type, family_user_id, entity_name, NEW.id,
        'Kunjungan Keluarga Sudah di Tindak Lanjut 2',
        'Kunjungan ' || entity_code || ' telah selesai dicatat.', target_puskesmas);
      INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
      VALUES ('sistem'::notification_type, 'admin_dinkes'::app_role, entity_name, NEW.id,
        'Kunjungan Keluarga Sudah di Tindak Lanjut 2',
        coalesce(family_name, 'Keluarga') || ' telah selesai dicatat.', target_puskesmas);
    END IF;
  END IF;

  IF (entity_name = 'keluarga' OR entity_name = 'kunjungan')
     AND (OLD.workflow_note IS DISTINCT FROM NEW.workflow_note)
     AND NEW.workflow_note IS NOT NULL THEN
    INSERT INTO public.notifications(notification_type, target_role, entity, entity_id, title, body, puskesmas_id)
    VALUES ('sistem'::notification_type, 'admin_dinkes'::app_role, entity_name, NEW.id,
      'Aktivitas Baru pada ' || entity_name,
      coalesce(entity_code, 'Data') || ' diperbarui: ' || NEW.workflow_note, target_puskesmas);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS keluarga_notify_workflow ON public.keluarga;

CREATE TRIGGER keluarga_notify_workflow
AFTER INSERT
OR
UPDATE ON public.keluarga FOR EACH ROW
EXECUTE FUNCTION public.notify_workflow_event ();

DROP TRIGGER IF EXISTS kunjungan_notify_workflow ON public.kunjungan;

CREATE TRIGGER kunjungan_notify_workflow
AFTER INSERT
OR
UPDATE ON public.kunjungan FOR EACH ROW
EXECUTE FUNCTION public.notify_workflow_event ();

DROP POLICY IF EXISTS notif_self_select ON public.notifications;

CREATE POLICY notif_role_scope_select ON public.notifications FOR
SELECT
    TO authenticated USING (
        target_user_id = auth.uid ()
        OR (
            target_role IS NOT NULL
            AND public.has_role (auth.uid (), target_role)
            AND (
                target_role = 'admin_dinkes'::app_role
                OR puskesmas_id IS NULL
                OR puskesmas_id = public.get_user_puskesmas_id (auth.uid ())
            )
        )
    );