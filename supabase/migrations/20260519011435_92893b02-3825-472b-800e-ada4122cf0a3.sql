
-- 1. Soft delete fields
ALTER TABLE public.puskesmas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- 2. Workflow status enum (future-ready)
DO $$ BEGIN
  CREATE TYPE public.workflow_status AS ENUM ('draft','diproses','selesai','diverifikasi','ditolak');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role public.app_role,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  puskesmas_id uuid,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_puskesmas ON public.audit_logs(puskesmas_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_admin_dinkes_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_dinkes_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_dinkes'::public.app_role));

DROP POLICY IF EXISTS audit_logs_admin_puskesmas_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_puskesmas_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin_puskesmas'::public.app_role)
    AND puskesmas_id = public.get_user_puskesmas_id(auth.uid())
  );

DROP POLICY IF EXISTS audit_logs_self_select ON public.audit_logs;
CREATE POLICY audit_logs_self_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- Inserts dilakukan melalui server function (service role), tidak butuh policy insert untuk authenticated.

-- 4. Helper RPC untuk audit log (boleh dipanggil server fn dengan service role; juga boleh user authenticated mencatat aksinya sendiri)
CREATE OR REPLACE FUNCTION public.log_audit(
  _actor_id uuid,
  _action text,
  _entity text,
  _entity_id uuid,
  _puskesmas_id uuid,
  _description text,
  _metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
  _id uuid;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _actor_id LIMIT 1;
  INSERT INTO public.audit_logs(actor_id, actor_role, action, entity, entity_id, puskesmas_id, description, metadata)
  VALUES (_actor_id, _role, _action, _entity, _entity_id, _puskesmas_id, _description, COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit(uuid,text,text,uuid,uuid,text,jsonb) TO authenticated, anon, service_role;

-- 5. Touch last login (dipanggil saat user sign in)
CREATE OR REPLACE FUNCTION public.touch_last_login(_user_id uuid) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET last_login_at = now(), last_activity_at = now() WHERE id = _user_id;
$$;

GRANT EXECUTE ON FUNCTION public.touch_last_login(uuid) TO authenticated, service_role;
