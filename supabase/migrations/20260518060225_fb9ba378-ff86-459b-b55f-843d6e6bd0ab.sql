-- Add foreign keys (so PostgREST embedded selects work) + email_konfirmasi column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_konfirmasi text;

-- Add FKs only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_puskesmas_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_puskesmas_id_fkey
      FOREIGN KEY (puskesmas_id) REFERENCES public.puskesmas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;