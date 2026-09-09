# SIPKESMAS — Setup

Sistem Informasi Puskesmas. Source bundle ini berisi semua kode yang dibutuhkan untuk menjalankan, mengembangkan, dan men-deploy aplikasi.

## Stack
- **Frontend & Server**: Next.js 15 App Router + React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (via `src/styles.css`) + shadcn/ui
- **Forms**: React Hook Form + Zod
- **Backend**: Supabase (Postgres, Auth, Storage)
- **Runtime target**: Node.js (Vercel atau hosting Node.js lain)
- **Package manager**: Bun

## Cepat jalan
```bash
bun install
bun run dev
```
Dev server berjalan di `http://localhost:3000`.

## Build production
```bash
bun run build
bun run start    # preview build
```

## Variabel environment
Lihat `.env` (sudah terisi nilai dev/preview). Untuk deployment sendiri, ganti dengan project Supabase Anda:

| Variable | Lingkup | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Publishable/anon key |
| `SUPABASE_URL` | server | URL project Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | server | Publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **RAHASIA.** Bypass RLS. Jangan commit publik. |

> **PENTING:** Jika Anda akan publish repo ini ke GitHub/publik, **rotasi service role key** terlebih dahulu di dashboard Supabase, lalu hapus dari `.env`.

## Database
Semua migrasi ada di `supabase/migrations/`. Terapkan via Supabase CLI:
```bash
supabase link --project-ref <ref>
supabase db push
```

## Struktur penting
```
src/
  app/                   # Next.js App Router
    (authenticated)/     # Layout gated by auth
    (public)/             # Halaman publik
  modules/               # Per-domain UI (keluarga, kunjungan, users, dst.)
  lib/                   # serverFn (*.functions.ts) + helper server (*.server.ts)
  components/            # Shared components (common, ui shadcn)
  hooks/                 # use-auth, use-role, dll.
  integrations/supabase/ # Generated clients — JANGAN diedit manual
  styles.css             # Tailwind v4 + design tokens
supabase/migrations/     # SQL migrations
docs/SIPKESMAS-PRD.md    # PRD lengkap
```

## Roles
- `admin_dinkes` — global, dapat override entity terdaftar
- `admin_puskesmas` — pengelola 1 puskesmas
- `perawat` — input keluarga & kunjungan
- `keluarga` — end-user (lihat data sendiri)

Detail flow, schema, RLS policy, dan roadmap lihat `docs/SIPKESMAS-PRD.md`.

## Catatan dev
- `node_modules/` dan `.git/` sengaja **tidak** disertakan — regenerate dengan `bun install` dan `git init` jika perlu.
- File di `src/integrations/supabase/` (`client.ts`, `client.server.ts`, `auth-middleware.ts`, `types.ts`) adalah integrasi Supabase; `types.ts` dapat dibuat ulang dari schema database.
