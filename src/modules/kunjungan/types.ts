import type { Database } from "@/integrations/supabase/types";

export type KunjunganRow = Database["public"]["Tables"]["kunjungan"]["Row"];

/**
 * Sumbu Status (draft/terdaftar) — BUKAN enum database, cuma diturunkan dari
 * kolom is_registered (lihat deriveStatusKunjungan di bawah). Menggantikan
 * enum status_kunjungan lama (draft/diproses/selesai/diverifikasi/dibatalkan)
 * yang sudah tidak dipakai lagi untuk kunjungan — lihat sipkesmas-rencana-teknis.md
 * bagian 0.1 (prinsip pencocokan).
 */
export type StatusKunjungan = "draft" | "terdaftar";

/**
 * Sumbu Tindakan — enum database asli (dibuat di migrasi fase 1).
 */
export type TindakanKunjungan = Database["public"]["Enums"]["tindakan_kunjungan"];

export type JenisKunjungan = Database["public"]["Enums"]["jenis_kunjungan"];

export const STATUS_KUNJUNGAN_OPTIONS: readonly StatusKunjungan[] = ["draft", "terdaftar"];

export const STATUS_KUNJUNGAN_LABEL: Record<StatusKunjungan, string> = {
  draft: "Draft",
  terdaftar: "Terdaftar",
};

export const STATUS_KUNJUNGAN_STYLE: Record<StatusKunjungan, string> = {
  draft: "bg-muted text-muted-foreground",
  terdaftar: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

export function deriveStatusKunjungan(row: Pick<KunjunganRow, "is_registered">): StatusKunjungan {
  return row.is_registered ? "terdaftar" : "draft";
}

export const TINDAKAN_KUNJUNGAN_OPTIONS: readonly TindakanKunjungan[] = [
  "pengajuan", "proses", "selesai",
];

export const TINDAKAN_KUNJUNGAN_LABEL: Record<TindakanKunjungan, string> = {
  pengajuan: "Pengajuan",
  disetujui: "Disetujui",
  proses: "Proses",
  selesai: "Selesai",
};

export const TINDAKAN_KUNJUNGAN_STYLE: Record<TindakanKunjungan, string> = {
  pengajuan: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  disetujui: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  proses: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  selesai: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

// Rencana: 3 opsi (rumah/puskesmas/darurat). Untuk sekarang cuma "rumah" yang
// aktif dipilih di form Tambah Kunjungan — 2 lainnya tetap didaftarkan di sini
// (dipakai buat radio button disabled), bukan dihapus dari pilihan.
export const JENIS_KUNJUNGAN_OPTIONS: readonly JenisKunjungan[] = [
  "rumah", "puskesmas", "darurat",
];

export const JENIS_KUNJUNGAN_AKTIF: readonly JenisKunjungan[] = ["rumah"];

export const JENIS_KUNJUNGAN_LABEL = {
  rumah: "Kunjungan Rumah",
  puskesmas: "Kunjungan Puskesmas",
  darurat: "Darurat",
} as Record<JenisKunjungan, string>;

export interface KunjunganWithRelations extends KunjunganRow {
  keluarga_nama: string | null;
  keluarga_code: string | null;
  perawat_nama: string | null;
  puskesmas_nama: string | null;
  tl1_mobil?: string[] | null;
  tl1_catatan?: string | null;
  tl1_tim?: string[];
}