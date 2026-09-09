# PRD — SIPKESMAS
**Sistem Informasi Perawatan Kesehatan Masyarakat**

Versi dokumen: 1.0 · Status: Perancangan Aktif · Tanggal: 8 Juni 2026

---

## 1. Ringkasan Produk

SIPKESMAS adalah platform digital pengelolaan layanan kesehatan masyarakat untuk **Dinas Kesehatan, Puskesmas, Perawat lapangan, dan Keluarga binaan**. Sistem ini memusatkan pendataan keluarga, pencatatan kunjungan, audit operasional, dan (di tahap berikutnya) rekam medis & manajemen obat — dengan workflow draft → registered yang menjamin integritas data resmi.

### 1.1 Tujuan Utama
- Menyatukan pendataan keluarga & kunjungan lapangan dalam satu sistem role-aware.
- Memastikan data resmi (*registered*) bersifat **immutable** kecuali override oleh Admin Dinkes.
- Memberikan audit trail penuh untuk setiap aksi operasional.
- Menyediakan dashboard kontekstual berbasis peran.

### 1.2 Non-Goals (Versi Saat Ini)
- Bukan EMR/EHR penuh — rekam medis hanya ringkasan asuhan.
- Bukan sistem klaim BPJS / billing.
- Bukan aplikasi native mobile (web responsive saja).

---

## 2. Stack Teknologi

### 2.1 Frontend
| Lapisan | Teknologi |
|---|---|
| Bahasa | **TypeScript** (strict) |
| Framework | **Next.js 15 App Router** + React 19 |
| Build tool | **Next.js build toolchain** |
| Routing | Next.js App Router (`app/`) |
| Data fetching | Server Actions dan service layer |
| Styling | **Tailwind CSS v4** (via `src/styles.css`, design tokens OKLCH) |
| Komponen UI | shadcn/ui + Radix UI primitives |
| Forms | React Hook Form + Zod |
| Ikon | lucide-react |
| Notifikasi | sonner (toast) |

### 2.2 Backend
| Lapisan | Teknologi |
|---|---|
| Runtime | **Node.js** melalui Vercel atau hosting Node.js |
| Server logic | Next.js Server Actions |
| Server routes | Next.js Route Handlers bila diperlukan |
| Database | **PostgreSQL** (Lovable Cloud / Supabase managed) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Storage | Supabase Storage (untuk lampiran ke depan) |
| Validasi | Zod (input validator pada semua serverFn) |

### 2.3 Konvensi Penting
- **Tidak ada Supabase Edge Functions** untuk logic internal — gunakan Next.js Server Actions.
- 3 client Supabase: `client.ts` (browser, RLS), `auth-middleware.ts` (serverFn as-user, RLS), `client.server.ts` (admin, bypass RLS).
- Semua tabel `public.*` wajib GRANT eksplisit + RLS + policy.

---

## 3. Manajemen Role

### 3.1 Daftar Role (`app_role` enum)
| Role | Scope | Kemampuan Inti |
|---|---|---|
| **admin_dinkes** | Global | Mengelola Puskesmas, semua user, override data registered, melihat seluruh laporan |
| **admin_puskesmas** | 1 Puskesmas | Mengelola Perawat & Keluarga di puskesmasnya, reset password, melihat laporan puskesmasnya |
| **perawat** | 1 Puskesmas | Tambah/edit keluarga & kunjungan (draft), tidak boleh edit data registered |
| **keluarga** | Diri sendiri | Lihat data keluarga sendiri, riwayat kunjungan, notifikasi |

### 3.2 Arsitektur Keamanan Role
- Tabel `user_roles` terpisah (1 user = 1 role) — **tidak pernah** disimpan di `profiles`.
- Fungsi `public.has_role(_user_id, _role)` `SECURITY DEFINER` untuk RLS non-rekursif.
- Fungsi `get_user_puskesmas_id(_user_id)` untuk scoping puskesmas.
- Semua privileged action di serverFn melakukan `assertRole()` sebelum eksekusi.

### 3.3 Matrix Akses Modul
| Modul | Dinkes | Adm. Puskesmas | Perawat | Keluarga |
|---|:-:|:-:|:-:|:-:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Puskesmas (CRUD) | ✅ | — | — | — |
| Manajemen User | ✅ (semua) | ✅ (scope puskesmas, hanya perawat/keluarga) | — | — |
| Tambah Keluarga | ✅ | ✅ | ✅ | — |
| Log / Daftar Keluarga | ✅ | ✅ | ✅ | — |
| Keluarga Saya | — | — | — | ✅ |
| Tambah Kunjungan | ✅ | ✅ | ✅ | — |
| Riwayat Kunjungan (personal) | — | — | — | ✅ |
| Rekam Medis / Obat | 🕒 Segera | 🕒 | 🕒 | 🕒 |
| Laporan | ✅ | ✅ | — | — |
| Audit Log | ✅ | scope puskesmas | — | — |
| Pengaturan | ✅ | ✅ | ✅ | ✅ |

---

## 4. Struktur Folder

```text
src/
├── app/                             # File-based routing (Next.js)
│   ├── __root.tsx                   # Shell HTML, providers
│   ├── index.tsx                    # Landing → redirect /dashboard atau /login
│   ├── login.tsx                    # Halaman login publik
│   ├── _authenticated.tsx           # Gate auth + DashboardLayout
│   ├── _authenticated/
│   │   ├── dashboard.tsx
│   │   ├── puskesmas.tsx
│   │   ├── users.tsx
│   │   ├── keluarga.tsx             # Parent: <Outlet />
│   │   ├── keluarga.index.tsx       # /keluarga (role-aware)
│   │   ├── keluarga.tambah.tsx
│   │   ├── keluarga.log.tsx
│   │   ├── keluarga.daftar.tsx
│   │   ├── keluarga.$keluargaId.tsx
│   │   ├── kunjungan.* (mirror)
│   │   ├── rekam-medis.tsx          # Placeholder "Segera Hadir"
│   │   ├── obat.tsx                 # Placeholder
│   │   ├── laporan.tsx
│   │   ├── audit-log.tsx
│   │   └── pengaturan.tsx
│   └── api/public/
│       └── hooks/auto-register.ts   # Cron endpoint: draft → registered
├── modules/                         # Vertical slices per domain
│   ├── auth/        (login form)
│   ├── dashboard/   (layout, sidebar, topbar, role-dashboard, navigation config)
│   ├── puskesmas/
│   ├── users/
│   ├── keluarga/    (views, components, schemas, types, utils)
│   ├── kunjungan/
│   └── audit/
├── lib/                             # Server functions (RPC)
│   ├── auth.functions.ts
│   ├── users.functions.ts
│   ├── keluarga.functions.ts
│   ├── kunjungan.functions.ts
│   ├── dashboard.functions.ts
│   ├── notification.functions.ts
│   ├── workflow.functions.ts
│   ├── audit.server.ts              # Helper internal
│   ├── workflow-state.ts            # State machine derive
│   └── constants/roles.ts           # Single source of truth role
├── components/
│   ├── ui/                          # shadcn primitives
│   └── common/                      # PageHeader, EmptyState, StatusBadge, dll.
├── hooks/                           # use-auth, use-role, use-mobile, use-governance
├── integrations/supabase/           # Auto-gen — JANGAN diedit
└── styles.css                       # Design tokens
```

---

## 5. Skema Database (PostgreSQL)

### 5.1 Tabel Inti
| Tabel | Tujuan | Catatan Kunci |
|---|---|---|
| `profiles` | Profil user (1:1 `auth.users`) | `puskesmas_id`, `username`, `last_login_at` |
| `user_roles` | Mapping user → role | Wajib terpisah; `has_role()` definer |
| `puskesmas` | Daftar Puskesmas | `kode` dipakai generator kode entitas |
| `keluarga` | Kepala keluarga binaan | `keluarga_code`, `workflow_status`, `is_registered`, `draft_expires_at`, `registered_at` |
| `anggota_keluarga` | Anggota tiap KK | FK ke `keluarga` |
| `kunjungan` | Catatan kunjungan lapangan | `kunjungan_code`, mirror workflow fields |
| `attachments` | Lampiran (foto/dokumen) | Untuk fase berikutnya |
| `audit_logs` | Jejak aksi | `actor_id`, `actor_role`, `entity`, `action`, `metadata` |
| `notifications` | Notifikasi role-aware | `notification_type`, `target_role`, `entity`, `entity_id` |

### 5.2 Workflow State Machine
```text
[draft] ──(48 jam expire / manual register)──▶ [registered]
   │                                                │
   │                                                ├── (override Admin Dinkes) ──▶ [override_dinkes]
   │                                                │
   ▼                                                ▼
[draft_expired]                              IMMUTABLE bagi non-Dinkes
```
- Trigger `keluarga_block_when_registered` & `kunjungan_block_when_registered` mencegah UPDATE/DELETE saat `is_registered = true`.
- Cron `/api/public/hooks/auto-register` memanggil `auto_register_expired_drafts()`.

### 5.3 Function Definer Penting
- `has_role`, `get_user_role`, `get_user_puskesmas_id` — dipakai RLS.
- `handle_new_user` — trigger auto-buat profile + role saat signup.
- `log_audit` — wrapper insert ke `audit_logs`.
- `notify_workflow_event` — trigger broadcast notifikasi saat transisi.
- `generate_entity_code_v2` — kode otomatis (e.g. `PKM01-0001`).

---

## 6. Modul & Fitur (Status Implementasi)

### 6.1 Sudah Berjalan (Master Block A/1 + A/2)
- ✅ Auth (email/password + Google OAuth) + role gating
- ✅ Sidebar role-aware (registry di `navigation.ts`)
- ✅ CRUD Puskesmas (Dinkes)
- ✅ Manajemen User (create, edit, reset password, toggle aktif)
- ✅ Keluarga: Tambah / Log / Daftar / Detail + workflow registered
- ✅ Kunjungan: Tambah / Log / Daftar / Detail + immutable banner
- ✅ Activity Timeline ber-actor (enriched dari `profiles` + `user_roles`)
- ✅ Dashboard stat kontekstual (registered hari ini, draft pending, expired)
- ✅ Audit log viewer
- ✅ Notifikasi bell (topbar)
- ✅ Auto-register cron endpoint

### 6.2 Segera Hadir (Roadmap Master Block B)
- 🕒 Rekam Medis (asuhan keperawatan: pengkajian, diagnosa, intervensi, evaluasi)
- 🕒 Obat (resep & stok dasar)
- 🕒 Laporan analitik lanjutan (export PDF/Excel)
- 🕒 Upload lampiran foto kunjungan
- 🕒 Modul keluarga end-user (lihat data sendiri penuh)

---

## 7. Alur Operasional Utama (User Journey)

### 7.1 Perawat — Pendataan Keluarga
```text
Login → Dashboard → Tambah Keluarga
   → Isi data KK + anggota (DRAFT, 48 jam)
   → Edit bebas selama draft
   → Auto-register ATAU manual register
   → Data menjadi RESMI & immutable
   → Notifikasi ke Admin Puskesmas
```

### 7.2 Perawat — Catat Kunjungan
```text
Detail Keluarga → "Catat Kunjungan" (quick action)
   → Form kunjungan (anamnesa, TTV, tindakan) → DRAFT
   → Submit → masuk Log Kunjungan
   → 48 jam → registered → immutable
```

### 7.3 Admin Dinkes — Override
```text
Detail entitas registered → "Override" (hanya Dinkes)
   → Wajib isi workflow_note (alasan)
   → Audit log mencatat override + alasan
   → Notifikasi broadcast
```

### 7.4 Keluarga — Personal
```text
Login (akun keluarga) → Dashboard personal
   → Keluarga Saya (readonly)
   → Riwayat Kunjungan
   → Notifikasi
```

---

## 8. Konvensi Keamanan

1. **RLS wajib aktif** di semua tabel `public.*`.
2. **GRANT eksplisit** di setiap migrasi `CREATE TABLE`.
3. Service-role key **hanya** dipakai di `client.server.ts` — tidak boleh diimpor di komponen.
4. Semua serverFn protected pakai `requireSupabaseAuth` middleware.
5. Input validasi Zod (min/max/regex) di semua serverFn & server routes.
6. Webhook publik wajib verifikasi signature (HMAC SHA-256).
7. Password minimal 8 karakter; phone format `+62 8XXX`.

---

## 9. Design System

- Tema: **light + dark**, token OKLCH di `src/styles.css`.
- Token semantik: `--background`, `--foreground`, `--primary`, `--muted`, `--accent`, `--destructive`.
- **Jangan** pakai class warna mentah (`text-white`, `bg-blue-500`) — selalu via token semantik.
- Status badge: 5 state workflow (`belum_terdaftar`, `pending_verifikasi`, `terdaftar`, `override_dinkes`, `draft_expired`).
- Komponen reusable: `PageHeader`, `EmptyState`, `RegisteredBanner`, `WorkflowStatusBadge`, `ActivityTimeline`, `StatCard`.

---

## 10. Roadmap Singkat

| Block | Fokus | Status |
|---|---|---|
| **A/1** | Struktur workflow, navigation, full-page routing | ✅ Done |
| **A/2** | Operational workflow activation (audit, immutable, dashboard hidup) | ✅ Done |
| **A/3** | Stabilisasi route & smoke test menyeluruh | 🔄 Sedang berjalan |
| **B/1** | Rekam Medis (asuhan keperawatan) | ⏭️ Next |
| **B/2** | Obat & resep | ⏭️ |
| **C/1** | Laporan lanjutan + export | ⏭️ |
| **C/2** | Lampiran foto + storage | ⏭️ |
| **D/1** | Modul Keluarga end-user lengkap + notifikasi push | ⏭️ |

---

## 11. Kriteria "Selesai" per Modul

Setiap modul dianggap *operationally complete* jika memenuhi:
1. CRUD penuh dengan RLS & GRANT benar.
2. Workflow draft → registered berfungsi + immutable enforcement.
3. Audit log tercatat untuk setiap mutasi.
4. Notifikasi terpicu sesuai role.
5. Dashboard stat memantulkan data modul ini.
6. List view: filter, search, pagination, empty state.
7. Detail view: metadata operasional + activity timeline + quick actions kontekstual.
8. Smoke test manual semua role lulus.

---

*Dokumen ini menjadi acuan tunggal perancangan SIPKESMAS. Update saat ada perubahan stack, role, atau roadmap.*
