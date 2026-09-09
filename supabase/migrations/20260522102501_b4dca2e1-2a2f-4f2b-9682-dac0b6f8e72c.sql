
ALTER TYPE public.workflow_status ADD VALUE IF NOT EXISTS 'registered';
ALTER TYPE public.workflow_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.workflow_status ADD VALUE IF NOT EXISTS 'archived';
