import { z } from "zod";

const nik16 = z
  .string()
  .trim()
  .regex(/^[0-9]{16}$/, "Harus 16 digit angka");

export const keluargaSchema = z.object({
  nomor_kk: nik16,
  kepala_keluarga: z.string().trim().min(2, "Nama kepala keluarga minimal 2 karakter").max(120),
  nik: nik16,
  alamat: z.string().trim().max(500).optional().or(z.literal("")),
  telepon: z
    .string()
    .trim()
    .regex(/^(\+62 8\d{7,13})?$/, "Format telepon harus +62 8XXX")
    .optional()
    .or(z.literal("")),
  status: z.enum(["aktif", "nonaktif", "pindah", "meninggal"]),
  puskesmas_id: z.string().uuid("Puskesmas wajib dipilih"),
});

export type KeluargaFormValues = z.infer<typeof keluargaSchema>;

export const anggotaSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  nik: z.string().trim().regex(/^([0-9]{16})?$/, "NIK harus 16 digit angka").optional().or(z.literal("")),
  hubungan: z.enum(["Kepala Keluarga", "Istri", "Anak", "Orang Tua", "Lainnya"]),
  tanggal_lahir: z.string().optional().or(z.literal("")),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
});

export type AnggotaFormValues = z.infer<typeof anggotaSchema>;
