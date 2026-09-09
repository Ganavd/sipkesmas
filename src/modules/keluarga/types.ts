import type { Database } from "@/integrations/supabase/types";

export type KeluargaRow = Database["public"]["Tables"]["keluarga"]["Row"];
export type AnggotaKeluargaRow = Database["public"]["Tables"]["anggota_keluarga"]["Row"];
export type StatusKeluarga = Database["public"]["Enums"]["status_keluarga"];
export type HubunganKeluarga = Database["public"]["Enums"]["hubungan_keluarga"];
export type JenisKelamin = Database["public"]["Enums"]["jenis_kelamin"];

export const STATUS_KELUARGA_OPTIONS: readonly StatusKeluarga[] = [
  "aktif", "nonaktif", "pindah", "meninggal",
];

export const HUBUNGAN_OPTIONS: readonly HubunganKeluarga[] = [
  "Kepala Keluarga", "Istri", "Anak", "Orang Tua", "Lainnya",
];

export const STATUS_LABEL: Record<StatusKeluarga, string> = {
  aktif: "Aktif",
  nonaktif: "Nonaktif",
  pindah: "Pindah",
  meninggal: "Meninggal",
};

export interface KeluargaWithRelations extends KeluargaRow {
  puskesmas_nama: string | null;
  anggota_count: number;
}
