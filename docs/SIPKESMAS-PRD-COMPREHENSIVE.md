# SIPKESMAS PRD — Comprehensive Product Requirements

Versi dokumen: 1.0
Status: Perancangan Aktif
Tanggal: 10 Juli 2026

---

## 1. Tujuan Produk

SIPKESMAS adalah aplikasi web informasi kesehatan masyarakat untuk:
- **Admin Dinas Kesehatan** (`admin_dinkes`)
- **Admin Puskesmas** (`admin_puskesmas`)
- **Perawat lapangan** (`perawat`)
- **Keluarga binaan** (`keluarga`)

Fokus utama:
- Pendataan keluarga dan kunjungan lapangan
- Workflow draft → registered dengan aturan batas waktu dan histori audit
- Role-aware navigation dan akses halaman sesuai peran
- Monitoring dan notifikasi operasional

Non-goals saat ini:
- Bukan EMR/EHR penuh
- Bukan sistem billing atau klaim BPJS
- Bukan aplikasi native mobile (web responsive saja)

---

## 2. Arsitektur Umum

### 2.1 Frontend

- **Framework**: Next.js App Router + React
- **UI & styling**: Tailwind CSS, shadcn/ui, Radix UI primitives
- **Routing**: Next.js file-based routing (`app/(authenticated)/...`)
- **State/auth**: Supabase Auth + custom `useAuth`
- **Komponen utama**: dashboard layout, sidebar, topbar, notification bell

### 2.2 Backend

- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Server logic**: Next.js Server Actions + Supabase server client
- **Role gating**: server-side assert role + RLS
- **Audit & notifikasi**: `audit_logs`, `notifications`

### 2.3 Kode Sumber Inti

- `app/(authenticated)/layout.tsx`: layout authenticated shell
- `src/modules/dashboard/components/dashboard-layout.tsx`: root dashboard layout
- `src/modules/dashboard/components/sidebar.tsx`: sidebar role-aware responsive
- `src/modules/dashboard/components/topbar.tsx`: top bar dengan notification, avatar, sign out
- `src/modules/dashboard/config/navigation.ts`: registry menu-role
- `src/components/common/notification-bell.tsx`: popover notifikasi + badge
- `src/hooks/use-auth.tsx`: auth context + profile/role cache
- `actions/keluarga.ts`, `actions/kunjungan.ts`: server-side action untuk data utama

---

## 3. Role & Hak Akses

### 3.1 Definisi role

| Role | Kode | Deskripsi |
|---|---|---|
| Admin Dinkes | `admin_dinkes` | Pengelola sistem tingkat Dinas Kesehatan |
| Admin Puskesmas | `admin_puskesmas` | Pengelola operasional puskesmas |
| Perawat | `perawat` | Perekam lapangan keluarga / kunjungan |
| Keluarga | `keluarga` | End-user keluarga yang menerima layanan |

### 3.2 Akses ke fitur utama

| Modul | `admin_dinkes` | `admin_puskesmas` | `perawat` | `keluarga` |
|---|:-:|:-:|:-:|:-:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Puskesmas | ✅ | — | — | — |
| Manajemen User | ✅ | ✅ | — | — |
| Tambah Keluarga | ✅ | ✅ | ✅ | — |
| Log / Daftar Keluarga | ✅ | ✅ | ✅ | — |
| Keluarga Saya | — | — | — | ✅ |
| Tambah Kunjungan | ✅ | ✅ | ✅ | — |
| Log / Daftar Kunjungan | ✅ | ✅ | ✅ | ✅? |
| Rekam Medis | 🕒 Segera | 🕒 | 🕒 | 🕒 |
| Obat | 🕒 Segera | 🕒 | 🕒 | 🕒 |
| Laporan | ✅ | ✅ | — | — |
| Audit Log | ✅ | ✅ (scope) | — | — |
| Pengaturan | ✅ | ✅ | ✅ | ✅ |

> Catatan: `keluarga` saat ini memiliki akses ke menu Personal (`Keluarga Saya`, `Riwayat Kunjungan`, `Rekam Medis`, `Obat`, `Notifikasi`) tetapi beberapa halaman masih placeholder.

---

## 4. Layout dan Navigasi

### 4.1 Shell utama

- `app/(authenticated)/layout.tsx` memastikan pengguna login.
- Jika belum login, redirect ke `/login`.
- Layout ini membungkus konten dengan `DashboardLayout`.

### 4.2 DashboardLayout

- Struktur utama: `Sidebar` + `Topbar` + `main content`
- `Sidebar` menggunakan `role` dari `useAuth()` untuk merender menu sesuai hak akses
- `Topbar` menampilkan toggle sidebar, notifikasi, avatar pengguna, dan logout
- `main` berisi konten halaman dengan padding responsif dan `ErrorBoundary`

### 4.3 Sidebar

- Collapsible: `collapsed` state
- Lebar:
  - penuh: `w-64` (~16rem)
  - collapsed: `w-[72px]`
- Mobile: overlay dengan backdrop blur dan sheet mode
- Symmetric/lebar otomatis: `transition-[transform,width] duration-200` dan lebar berubah dengan opsi collapse
- Menu grouped by section
- Icon + label, dengan tooltip/informasi saat collapsed

### 4.4 Topbar

- Sticky di atas konten
- Tombol mobile menu untuk breakpoint `lg` ke bawah
- Tombol toggle sidebar untuk desktop
- Role badge di atas layar
- Notification bell di topbar kanan
- Avatar + dropdown profile + logout

### 4.5 Notifikasi

- Komponen: `src/components/common/notification-bell.tsx`
- Ikon: `Bell`
- Lencana unread count
- Popover dengan daftar notifikasi
- Tombol `Tandai semua`
- Refresh setiap 60 detik dan reload saat popover dibuka

---

## 5. Sidebar & Menu Detail

### 5.1 Pengaturan menu role-aware

Registry menu utama:
- Utama
  - Dashboard
- Manajemen Organisasi
  - Puskesmas
  - Manajemen User
- Keluarga
  - Tambah Keluarga
  - Log Keluarga
  - Daftar Keluarga
- Pendataan
  - Tambah Pendataan
    - Tambah Kunjungan
    - Tambah Asuhan
    - Tambah Obat
  - Log Kunjungan
  - Daftar Kunjungan
  - Log Asuhan
  - Daftar Asuhan
  - Log Obat
  - Daftar Obat
- Personal
  - Keluarga Saya
  - Riwayat Kunjungan
  - Rekam Medis
  - Obat
  - Notifikasi
- Analitik
  - Laporan
- Sistem
  - Pengaturan

### 5.2 Logika menu

- `getNavSectionsForRole(role)` memfilter item berdasarkan `roles`
- Submenu hanya dirender jika ada item anak yang cocok dengan role
- Menu disabled dan coming soon ditampilkan sebagai non-clickable bila belum tersedia

### 5.3 UI item

- Item aktif diberi class `bg-sidebar-accent text-sidebar-accent-foreground`
- Ikon berubah warna bila aktif
- Collapse mode: hanya ikon tampil, teks disembunyikan
- Konten sidebar responsif dan tetap simetris ketika collapsed / expanded

---

## 6. Halaman Utama & States

### 6.1 Halaman login

- `app/(public)/login/page.tsx`
- Auth guard / redirect dari authenticated layout
- Form login dan kemungkinan SSO (Google OAuth) di `auth.service`

### 6.2 Dashboard

- `app/(authenticated)/dashboard/page.tsx`
- Jika `useAuth().isLoading`: tampilkan `Loading`
- Jika `role` belum diatur: tampilkan `EmptyState`
- Jika role ada: render `RoleDashboard`

#### State dashboard
- Loading
- Role missing
- Role valid → konten dashboard

### 6.3 Puskesmas

- `app/(authenticated)/puskesmas/page.tsx`
- Render `PuskesmasView`
- Akses: hanya `admin_dinkes`

### 6.4 Users

- `app/(authenticated)/users/page.tsx`
- Render `UsersView`
- Akses: `admin_dinkes`, `admin_puskesmas`

### 6.5 Keluarga

- `app/(authenticated)/keluarga/page.tsx` redirect ke `/keluarga/log`
- `app/(authenticated)/keluarga/tambah/page.tsx` form penambahan keluarga
- `app/(authenticated)/keluarga/log/page.tsx` (exist, status log)
- `app/(authenticated)/keluarga/daftar/page.tsx` (exist, status list)
- `app/(authenticated)/keluarga/[keluargaId]/page.tsx` detail keluarga

#### Status halaman `Tambah Keluarga`
- Form validation: Zod + React Hook Form
- Input: `nomor_kk`, `kepala_keluarga`, `nik`, `telepon`, `alamat`, `status`, `puskesmas_id`
- `admin_dinkes` dapat memilih Puskesmas; selainnya `puskesmas_id` diambil dari profile
- Tombol: `Batal` + `Simpan Keluarga`
- Aksi: submit via `createKeluarga` di `actions/keluarga.ts`

### 6.6 Kunjungan

- `app/(authenticated)/kunjungan/page.tsx` redirect ke `/kunjungan/log`
- `app/(authenticated)/kunjungan/tambah/page.tsx` form tambah kunjungan
- `app/(authenticated)/kunjungan/log/page.tsx`
- `app/(authenticated)/kunjungan/daftar/page.tsx`
- `app/(authenticated)/kunjungan/[kunjunganId]/page.tsx`

### 6.7 Audit Log

- `app/(authenticated)/audit-log/page.tsx`
- Akses: `admin_dinkes`, `admin_puskesmas`
- Menampilkan riwayat aktivitas sistem

### 6.8 Laporan

- `app/(authenticated)/laporan/page.tsx`
- Status: placeholder `EmptyState` dengan pesan "Segera Hadir"
- Akses: `admin_dinkes`, `admin_puskesmas`

### 6.9 Pengaturan

- `app/(authenticated)/pengaturan/page.tsx`
- Menampilkan info user dan tautan `Audit Log` untuk admin
- Akses: semua role
- State: profile available / loading

### 6.10 Obat

- `app/(authenticated)/obat/page.tsx`
- Status: placeholder `EmptyState`
- Akses: semua role di sidebar, tetapi konten belum dibangun

### 6.11 Rekam Medis

- `app/(authenticated)/rekam-medis/page.tsx`
- Status: placeholder `EmptyState`
- Akses: semua role di sidebar, tetapi konten belum dibangun

---

## 7. Elemen UI & Aksi

### 7.1 Sidebar

- `Tombol Toggle Sidebar`: desktop collapse/expand
- `Tombol Mobile Menu`: buka/ tutup sidebar di layar kecil
- `Section label`: tajuk group menu
- `Menu item`: navigasi halaman
- `Submenu`: `Tambah Pendataan` menampilkan anak item jika expand

### 7.2 Topbar

- `Menu mobile` (ikon `Menu`)
- `Toggle collapsed` (ikon `PanelLeft` / `PanelLeftClose`)
- `Role badge`
- `Notification bell` dengan lencana jumlah unread
- `Avatar + dropdown`
- `Logout` dari dropdown

### 7.3 Notifikasi

- `Bell icon` menunjukkan jumlah notifikasi belum dibaca
- `Popover` menampilkan daftar notifikasi
- `Tombol Tandai semua` menandai semua sebagai dibaca
- `Notifikasi kosong` menampilkan pesan placeholder

### 7.4 Form & aksi data

- `Tambah Keluarga`:
  - `Simpan Keluarga`
  - `Batal`
- `Tambah Kunjungan`:
  - `Simpan Kunjungan`
  - `Batal`
- `Manajemen User` → aksi CRUD user
- `Puskesmas` → aksi CRUD puskesmas (Admin Dinkes)
- `Audit Log` → filter / riwayat
- `Laporan` → export / analitik (roadmap)

---

## 8. Backend Workflow & Data Flow

### 8.1 Auth & Konteks

- `useAuth` memuat session Supabase
- `profileService.getProfile()` dan `profileService.getRole()` memuat data user
- `AuthContext` menyimpan:
  - `user`
  - `profile`
  - `role`
  - `isAuthenticated`
  - `isLoading`
- Role dan profile disimpan ke `localStorage` untuk percepatan

### 8.2 Server action utama

- `actions/keluarga.ts`:
  - `createKeluarga`
  - `updateKeluarga`
  - `softDeleteKeluarga`
  - `createAnggota`
  - `deleteAnggota`
- `actions/kunjungan.ts`:
  - `createKunjungan`
  - `updateKunjungan`
  - `updateKunjunganStatus`
  - `softDeleteKunjungan`
- `notification.functions.ts`:
  - `listNotifications`
  - `markNotificationRead`

### 8.3 Validasi dan security

- Semua input server-side divalidasi dengan Zod
- Aksi server memanggil `checkAuth()` / `requireSupabaseAuth`
- `createClient()` server memeriksa session dan user
- `writeAudit()` mencatat setiap mutasi data
- Keluarga / kunjungan yang dibuat hanya boleh di dalam scope puskesmas yang tepat

### 8.4 Audit dan notifikasi

- Setiap create/update/delete mencatat ke `audit_logs`
- Notifikasi disimpan di tabel `notifications`
- Notifikasi list dan mark-read tersedia lewat server function
- `notification-bell` menampilkan data realtime untuk pengguna saat login

### 8.5 Workflow draft → registered

- `Keluarga` dan `Kunjungan` dibuat sebagai draft/record awal
- Setelah diverifikasi atau auto-registered, entitas menjadi resmi
- Data registered harus immutable bagi non-Admin Dinkes
- Ada cron endpoint / hook (terlihat di desain) untuk auto-register draft expired
- `override` kebijakan hanya tersedia untuk Admin Dinkes

---

## 9. Keterangan Implementasi dan Gap

### 9.1 Modul yang sudah terbangun

- Auth + login redirect
- Dashboard role-aware
- Sidebar collapsible + responsive
- Topbar notifikasi + avatar + logout
- Keluarga tambah + log + daftar + detail navigation
- Kunjungan tambah + log + daftar
- Puskesmas view
- Users view
- Audit log akses
- Pengaturan dasar
- Notifikasi bell dan list
- Role-based menu filtering

### 9.2 Modul yang masih perlu dikembangkan

- `Laporan`: placeholder; harus dibangun sebagai analytic dashboard dan export
- `Obat`: placeholder; butuh CRUD obat, stock, resep
- `Rekam Medis`: placeholder; butuh form asuhan, catatan tindakan, ringkasan medis
- `Keluarga Saya`: meskipun ada menu, konten per role keluarga perlu implementasi lengkap
- `Riwayat Kunjungan` untuk role keluarga: perlu view daftar kunjungan terkait
- `Setting Profil`: ubah nama, email, password, preferensi
- `Auto-register` mekanisme backend perlu diverifikasi jika sudah ada di route/api

### 9.3 Rekomendasi langkah selanjutnya

1. Bangun modul `Rekam Medis` dan `Obat` dengan state CRUD + status
2. Lengkapi halaman personal `Keluarga Saya` dan `Riwayat Kunjungan`
3. Tambahkan fitur `Export PDF/Excel` di `Laporan`
4. Tambah user setting update profil + password reset
5. Pastikan RLS Supabase sudah terpasang lengkap dan audit dijaga konsisten
6. Evaluasi kembali penempatan notifikasi: saat ini di topbar kanan; jika butuh di kiri atas, swap position di `Topbar`

---

## 10. Mengapa AI bisa membangun ini dari PRD

Dokumen ini memuat:
- role dan hak akses detail
- halaman utama dan statusnya
- komponen UI penting: sidebar, topbar, notifikasi
- alur operasi: tambah keluarga, tambah kunjungan, audit, notifikasi
- arsitektur front-end dan backend
- data penting: form fields, validasi, workflow state

Jadi, jika PRD ini diberikan ke AI developer, ia dapat:
- menggambar interface sidebar/topbar dengan collapse otomatis
- membangun menu role-aware dan page skeleton
- menulis form `Tambah Keluarga` dan `Tambah Kunjungan`
- menerapkan auth + role gating
- menyiapkan placeholder `Laporan`, `Obat`, `Rekam Medis`

---

## 11. Lampiran: Pengamatan Teknis Kode Saat Ini

- Sidebar collapse lebar: `w-[72px]` (collapsed) / `w-64` (expanded)
- Mobile overlay: backdrop blur dan sheet menu
- Sidebar registry di `src/modules/dashboard/config/navigation.ts`
- `Topbar` menggunakan `Button`, `DropdownMenu`, `Avatar`, `RoleBadge`
- `NotificationBell` mengkonsumsi server function dan memuat notifikasi dengan `useEffect`
- `AuthProvider` caching role/profile di `localStorage`
- `KeluargaTambahPage` melakukan `puskesmasService.list()` dan mengisi `puskesmas_id`
- `createKeluarga` dan `createKunjungan` memanggil audit writer setelah insert

---

## 12. Kesimpulan

SIPKESMAS adalah aplikasi role-aware dengan fokus operasional:
- pendataan keluarga
- rekam kunjungan
- audit trail
- notifikasi

Dokumen ini merepresentasikan apa yang sudah ada, bagaimana halaman bekerja, dan area mana yang masih placeholder. Dengan struktur ini, pengembangan lanjutan bisa dilakukan terarah dan modul yang belum lengkap bisa diisi sesuai roadmap.
