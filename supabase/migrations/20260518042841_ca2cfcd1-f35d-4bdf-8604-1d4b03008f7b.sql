-- Remove duplicate roles, keep the highest-privilege one per user
WITH ranked AS (
  SELECT id,
         user_id,
         role,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY CASE role
             WHEN 'admin_dinkes' THEN 1
             WHEN 'admin_puskesmas' THEN 2
             WHEN 'perawat' THEN 3
             WHEN 'keluarga' THEN 4
           END
         ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Enforce one role per user going forward
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);