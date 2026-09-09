# SIPKESMAS UI/UX Prompt

## Tujuan Prompt
Dokumen ini ditujukan untuk AI desain UI/UX. Fokus hanya pada tampilan, tata letak, navigasi, dan interaksi visual aplikasi web SIPKESMAS. Tidak termasuk aturan sistem, peran keamanan, atau logika backend.

## Deskripsi Umum
SIPKESMAS adalah aplikasi web dashboard kesehatan masyarakat dengan layout admin-friendly. Aplikasi memiliki:
- halaman login sederhana
- dashboard ringkasan statistik
- sidebar collapsible yang tetap simetris ketika memperkecil
- topbar dengan ikon notifikasi di kiri-atas / dekat kiri atas
- avatar pengguna, tombol aksi, dan notifikasi popover
- konten halaman berbentuk kartu, tabel, dan detail panel
- responsive layout untuk desktop dan mobile

### Karakter UI
- Modern, bersih, profesional, tetapi hangat
- warna netral + aksen primer untuk highlight
- banyak ruang putih, sudut lembut, bayangan tipis
- teks ringkas, label jelas, tombol dengan hierarki visual

## Struktur Layout

### 1. Login Page
- centered card di tengah layar
- logo/brand di atas: `SIPKESMAS`
- judul besar: "Masuk ke SIPKESMAS"
- field email dan password
- tombol login utama
- catatan kecil: "Masuk hanya untuk pengguna terdaftar"
- pilihan no-sign-up, hanya navigasi ke dashboard jika kredensial valid

### 2. Dashboard Shell
- layout dua kolom utama: sidebar kiri + konten utama
- topbar horizontal di atas konten utama
- sidebar lebar `16rem` saat expanded, hanya ikon `4rem` saat collapsed
- ketika sidebar diperkecil, konten utama melebar secara otomatis dan tata letaknya tetap seimbang
- topbar sticky dengan latar semi-transparan
- notifikasi berada di kiri atas area topbar, diikuti oleh tombol toggle sidebar, lalu avatar user / menu profil di kanan

### 3. Sidebar
- group menu dengan section label kecil
- ikon + label per item
- collapsed mode: hanya ikon, teks tersembunyi
- menu utama meliputi:
  - Dashboard
  - Puskesmas
  - Manajemen User
  - Tambah Keluarga
  - Log Keluarga
  - Daftar Keluarga
  - Tambah Pendataan (dropdown)
  - Log Kunjungan
  - Daftar Kunjungan
  - Keluarga Saya
  - Riwayat Kunjungan
  - Rekam Medis
  - Obat
  - Laporan
  - Pengaturan
- sub-menu pada "Tambah Pendataan" menampilkan anak item ketika expanded
- di collapsed mode tetap ada titik fokus icon center
- footer kecil di bawah dengan Copyright / versi sistem

### 4. Topbar
- tombol menu mobile (hamburger) di kiri atas saat layar kecil
- toggle sidebar di desktop
- notifikasi bell di kiri-atas, dengan badge merah kecil untuk jumlah unread
- avatar user dengan dropdown profil dan logout
- jika role ada, tampilkan badge singkat di topbar: misalnya "Admin Dinkes" / "Perawat" / "Keluarga"

### 5. Notification Popover
- ketika klik bell, munculkan popover
- header popover: "Notifikasi"
- `Tandai semua` di kanan header
- daftar notifikasi dengan judul, ringkasan, waktu relative
- notifikasi baru diberi badge kecil "Baru"
- jika kosong, tampilkan placeholder teks

## Halaman & Komponen UI

### A. Dashboard
- judul halaman: "Dashboard"
- ringkasan statistik di atas: beberapa stat card horizontal
  - contoh: "Keluarga Terdaftar", "Kunjungan Hari Ini", "Draft Menunggu"
- grafik ringkas atau panel chart kecil (area / bar) untuk "Tren Kunjungan"
- card cepat: "Tambah Keluarga", "Tambah Kunjungan", "Lihat Log"
- panel ringkasan: "Notifikasi Terbaru", "Aktivitas Terakhir"

### B. Puskesmas
- halaman list/table dengan header: "Puskesmas"
- card atau tabel dengan kolom: nama puskesmas, kode, status, aksi
- action buttons kecil: "Edit", "Detail"
- tombol utama di kanan atas: "Tambah Puskesmas"
- jika tidak ada data, tampilkan empty state dengan ilustrasi ringan

### C. Manajemen User
- halaman daftar user dalam tabel
- kolom: nama, email, role, puskesmas, status, aksi
- tombol atas: "Tambah User", "Export"
- filter status / role di atas tabel
- baris action: tombol icon untuk edit dan nonaktifkan

### D. Tambah Keluarga
- halaman form dengan header dan deskripsi singkat
- panel card form: field input dan dropdown
- layout dua kolom responsif
- field utama:
  - Nomor KK
  - Kepala Keluarga
  - NIK
  - Telepon
  - Alamat
  - Status keluarga
  - Puskesmas (hanya untuk admin tertentu)
- tombol bawah: "Batal" + "Simpan Keluarga"
- state loading pada tombol submit

### E. Log Keluarga / Daftar Keluarga
- halaman list dengan filter dan search bar
- tabel atau card list dengan kolom: KK, Kepala Keluarga, Status, Puskesmas, Aksi
- aksi row: "Lihat" / "Edit" / "Daftarkan" jika applicable
- bagian atas tampilan ringkas jumlah keseluruhan

### F. Tambah Kunjungan
- halaman form dengan card dan input
- field: pilih keluarga, jenis kunjungan, tanggal kunjungan, catatan awal
- tombol: "Simpan Kunjungan" dan "Batal"
- jika UI memungkinkan, sediakan wizard singkat atau progress step

### G. Log Kunjungan / Daftar Kunjungan
- halaman list dengan tabel / card
- kolom: kode kunjungan, keluarga, jenis, tanggal, status, aksi
- filter status / tanggal
- row actions: "Detail"

### H. Keluarga Saya
- halaman pribadi untuk role keluarga
- tampilkan summary kartu keluarga, alamat, status
- sekilas tentang kunjungan terbaru dan notifikasi
- tombol kecil: "Lihat Detail"

### I. Riwayat Kunjungan
- halaman list kunjungan untuk anggota keluarga
- card list atau tabel singkat
- setiap item berisi tanggal, jenis, status, ringkasan catatan

### J. Rekam Medis
- halaman placeholder dengan label "Rekam Medis"
- tampilan awal: ilustrasi, teks "Segera Hadir"
- jika memungkinkan, tambahkan struktur judul panel untuk data medis nanti

### K. Obat
- halaman placeholder "Manajemen Obat"
- tombol `Tambah Obat` disabled / ditandai segera hadir
- daftar obat default tidak aktif

### L. Laporan
- halaman placeholder analitik
- konten: card besar dengan ilustrasi dan teks "Laporan & Analitik Segera Hadir"

### M. Pengaturan
- header: "Pengaturan"
- kartu profil pengguna dengan nama, email, role
- opsi menu kecil: "Ubah Profil", "Ubah Password", "Audit Log"
- card informasi sistem di bawah

### N. Audit Log
- timeline vertikal atau tabel aktivitas
- setiap baris: waktu, aktor, aksi, deskripsi singkat
- sidebar kecil bisa menunjukkan filter tanggal atau jenis aksi

## Interaksi Visual & States

### Sidebar
- collapsed/expanded animation smooth
- saat collapsed, ikon menjadi center-aligned dan label tidak terlihat
- highlight item aktif warna aksen
- hover memberikan highlight ringan

### Topbar
- notifikasi di kiri atas topbar
- badge merah kecil untuk unread count
- dropdown avatar berbentuk panel kecil
- mobile topbar simplifikasi dengan hamburger menu

### Form
- gunakan field card dengan border lembut
- fokus field dengan outline aksen
- help text teks kecil di bawah input
- validasi visual: pesan error kecil merah
- tombol action jelas dan kontras

### Tab dan filter
- gunakan pill button / segmented control untuk status
- filter berada di atas tabel
- search bar dengan icon search di kiri

### Empty state
- gunakan ilustrasi sederhana
- teks utama dan deskripsi ringkas
- CTA tombol utama jika diperlukan

### Responsiveness
- pada layar kecil, sidebar berubah menjadi drawer/overlay
- topbar menyusut; tombol menu mobile muncul
- form berubah satu kolom
- statistik card stack vertikal

## Arahan Visual Detail

- Skema warna: netral + aksen biru / hijau kesehatan
- Tipografi: judul besar, subjudul medium, teks body standar
- Ikon: silhouette dashboard, building, users, clipboard, heart, pill, chart, settings, bell
- Card: rounded corners, shadow halus, padding konsisten
- Tabel: baris dengan hover highlight, zebra stripe ringan optional
- Badge status: warna hijau untuk aktif, kuning untuk draft, abu-abu untuk placeholder

## Contoh Prompt untuk AI Desain

> Buat UI web dashboard SIPKESMAS sebagai aplikasi operasional kesehatan masyarakat. Layout utama terdiri dari sidebar collapsible, topbar, dan konten dashboard. Sidebar berisi 3-4 section menu, dengan submenu "Tambah Pendataan". Topbar memiliki ikon notifikasi di kiri atas, badge unread, dan avatar user di kanan. Halaman utama adalah dashboard statistik dengan card summary, grafis ringkas, dan panel notifikasi terbaru. Sertakan halaman form tambah keluarga, tabel log keluarga, daftar kunjungan, halaman profil pengaturan, dan placeholder untuk laporan, obat, rekam medis. Gunakan gaya modern, bersih, profesional, responsif.

## Catatan
- Prompt ini tidak memerlukan aturan sistem detail.
- Fokus pada visual komponen, halaman, dan pengalaman navigasi.
- Buat desain yang bisa langsung dikodekan sebagai web dashboard modern.
