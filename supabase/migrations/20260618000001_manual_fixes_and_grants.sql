-- =============================================================
-- SIPKESMAS — Manual Fixes & Grants
-- Tanggal: 18 Juni 2026
-- Deskripsi: Rekaman SQL yang sudah dijalankan manual di SQL Editor.
--            File ini IDEMPOTENT — aman dijalankan ulang tanpa efek samping.
-- =============================================================

-- ------------------------------------------------------------
-- 1. GRANT ke role authenticated (akses tabel dari frontend via RLS)
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO authenticated;

-- ------------------------------------------------------------
-- 2. GRANT ke role service_role (akses admin, bypass RLS — dipakai client.server.ts)
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL PRIVILEGES ON TABLE public.profiles        TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.user_roles      TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.puskesmas       TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.keluarga        TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.anggota_keluarga TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.kunjungan       TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.notifications   TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.attachments     TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.audit_logs      TO service_role;

-- ------------------------------------------------------------
-- 3. Hapus constraint duplikat di user_roles
--    (user_roles_user_id_role_key adalah composite UNIQUE lama
--     yang bertentangan dengan user_roles_user_id_unique yang baru)
-- ------------------------------------------------------------
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- ------------------------------------------------------------
-- 4. Tambah nilai enum workflow_status yang dipakai frontend
--    (override_dinkes = Admin Dinkes override data registered)
--    (draft_expired   = draft melewati batas 48 jam, belum auto-register)
-- ------------------------------------------------------------
ALTER TYPE public.workflow_status
  ADD VALUE IF NOT EXISTS 'override_dinkes';

ALTER TYPE public.workflow_status
  ADD VALUE IF NOT EXISTS 'draft_expired';
