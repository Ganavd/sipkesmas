import { ROLES, type AppRole } from "@/lib/constants/roles";
import type { StatusKunjungan, TindakanKunjungan } from "@/modules/kunjungan/types";

/**
 * Aturan aksi per role (sipkesmas-rencana-revisi.md bagian 6.3):
 * - Admin Dinkes & Admin Puskesmas: Edit/Lihat/Hapus tetap ada sampai
 *   tindakan = 'selesai'.
 * - Perawat: Edit/Lihat/Hapus cuma selama status masih 'draft', begitu
 *   'terdaftar' langsung terkunci permanen jadi Lihat saja.
 * - Begitu tindakan = 'selesai', semua role cuma Lihat, tanpa kecuali.
 */
export function getKunjunganActions(
  role: AppRole | null,
  status: StatusKunjungan,
  tindakan: TindakanKunjungan,
): { canEdit: boolean; canDelete: boolean } {
  // Admin Dinkes bisa edit/hapus asalkan kapanpun.
  if (role === ROLES.ADMIN_DINKES) {
    return { canEdit: true, canDelete: true };
  }

  // Jika tindakan sudah 'proses', 'selesai', atau 'batal', tidak ada yang bisa edit/hapus.
  if (tindakan !== "pengajuan") {
    return { canEdit: false, canDelete: false };
  }

  // Admin Puskesmas bisa edit/hapus asalkan tindakan masih 'pengajuan' (dan status pastinya 'terdaftar' jika sudah pengajuan).
  if (role === ROLES.ADMIN_PUSKESMAS) {
    return { canEdit: true, canDelete: true };
  }

  // Perawat HANYA bisa edit/hapus jika status masih 'draft'. 
  // Jika sudah 'terdaftar', perawat kehilangan akses edit/hapus.
  if (role === ROLES.PERAWAT) {
    const isDraft = status === "draft";
    return { canEdit: isDraft, canDelete: isDraft };
  }

  return { canEdit: false, canDelete: false };
}