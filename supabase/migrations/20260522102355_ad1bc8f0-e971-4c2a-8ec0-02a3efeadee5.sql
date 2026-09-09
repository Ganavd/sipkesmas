
DO $$ BEGIN
  CREATE TYPE public.workflow_status AS ENUM ('draft', 'pending', 'registered', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
