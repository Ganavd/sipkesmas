ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO
    storage.buckets (id, name, public)
VALUES
    ('profile-avatars', 'profile-avatars', true) ON CONFLICT (id)
DO
UPDATE
SET
    public = true;

DROP POLICY IF EXISTS profile_avatars_public_read ON storage.objects;

CREATE POLICY profile_avatars_public_read ON storage.objects FOR
SELECT
    TO public USING (bucket_id = 'profile-avatars');