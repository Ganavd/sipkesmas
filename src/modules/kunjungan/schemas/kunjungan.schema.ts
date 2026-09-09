import { z } from "zod";

export const kunjunganInputSchema = z.object({
  keluarga_id: z.string().uuid(),
  jenis_kunjungan: z.enum(["rumah", "puskesmas", "darurat", "kontrol"]),
  status: z.enum(["draft", "diproses", "selesai", "diverifikasi", "dibatalkan"]).default("draft"),
  catatan_awal: z.string().trim().max(2000).optional().default(""),
  tanggal_kunjungan: z.string().min(1, "Tanggal kunjungan wajib diisi"),
});

export type KunjunganInput = z.infer<typeof kunjunganInputSchema>;