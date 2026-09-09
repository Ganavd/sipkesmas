/**
 * Kunjungan — server functions. RLS-aware. Audit via service role.
 */
"use server";

import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit, enrichAuditItems } from "@/lib/audit.server";

const FIELD_LABEL: Record<string, string> = {
  keluarga_id: "keluarga",
  jenis_kunjungan: "jenis kunjungan",
  is_registered: "status terdaftar",
  tindakan: "tindakan",
  catatan_awal: "catatan awal",
  tanggal_kunjungan: "tanggal kunjungan",
};

function describeChanges(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): string[] {
  const changed: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const prev = before[k] ?? null;
    const next = v ?? null;
    if (prev !== next) changed.push(FIELD_LABEL[k] ?? k);
  }
  return changed;
}

const getKunjunganActivitySchema = z.object({
  kunjunganId: z.string().uuid(),
  limit: z.number().min(1).max(50).optional(),
});

export type GetKunjunganActivityInput = z.infer<typeof getKunjunganActivitySchema>;

export async function getKunjunganActivity(input: GetKunjunganActivityInput) {
  const { supabase } = await requireSupabaseAuth();
  const data = getKunjunganActivitySchema.parse(input);
  const limit = data.limit ?? 15;
    const { data: rawItems } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("entity", "kunjungan")
      .eq("entity_id", data.kunjunganId)
      .order("created_at", { ascending: false })
      .limit(limit);
    const items = await enrichAuditItems(rawItems ?? []);
  return { items };
}

// Ganti skema create agar memakai tindakan & is_registered
const createSchema = z.object({
  keluarga_id: z.string().uuid(),
  jenis_kunjungan: z.enum(["rumah", "puskesmas", "darurat"]),
  is_registered: z.boolean().default(false),
  tindakan: z.enum(["pengajuan", "disetujui", "proses", "selesai"]).default("pengajuan"),
  catatan_awal: z.string().trim().max(2000).optional().default(""),
  tanggal_kunjungan: z.string().min(1),
});

export type CreateKunjunganInput = z.infer<typeof createSchema>;

export async function createKunjungan(input: CreateKunjunganInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = createSchema.parse(input);

    // Ambil puskesmas_id dari keluarga (scope-aware via RLS)
    const { data: keluarga, error: keErr } = await supabase
      .from("keluarga")
      .select("id, puskesmas_id, kepala_keluarga")
      .eq("id", data.keluarga_id)
      .maybeSingle();
    if (keErr) throw new Error(keErr.message);
    if (!keluarga) throw new Error("Keluarga tidak ditemukan atau tidak dalam lingkup Anda.");

    const kunjunganCode = "DRAFT-" + crypto.randomUUID();

    const { data: row, error } = await supabase
      .from("kunjungan")
      .insert({
        keluarga_id: data.keluarga_id,
        puskesmas_id: keluarga.puskesmas_id,
        perawat_id: userId,
        jenis_kunjungan: data.jenis_kunjungan,
        tindakan: data.tindakan,
        is_registered: data.is_registered,
        catatan_awal: data.catatan_awal || null,
        tanggal_kunjungan: new Date(data.tanggal_kunjungan).toISOString(),
        created_by: userId,
        updated_by: userId,
        kunjungan_code: kunjunganCode,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: userId,
      action: "create",
      entity: "kunjungan",
      entityId: row.id,
      puskesmasId: row.puskesmas_id,
      description: `Mencatat kunjungan ${row.kunjungan_code} untuk keluarga ${keluarga.kepala_keluarga}.`,
      metadata: { keluarga_id: row.keluarga_id, jenis: row.jenis_kunjungan, is_registered: row.is_registered, tindakan: row.tindakan },
    });
  return { kunjungan: row };
}

const updateKunjunganSchema = z.object({
  id: z.string().uuid(),
  patch: createSchema.partial(),
});

export type UpdateKunjunganInput = z.infer<typeof updateKunjunganSchema>;

export async function updateKunjungan(input: UpdateKunjunganInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = updateKunjunganSchema.parse(input);

  const { data: before } = await supabase
    .from("kunjungan")
    .select("*")
    .eq("id", data.id)
    .maybeSingle();

  if (!before) throw new Error("Kunjungan tidak ditemukan.");

  // Jika keluarga_id diubah, validasi keberadaan keluarga baru & ambil puskesmas_id nya
  let puskesmasIdToUpdate: string | undefined = undefined;
  if (data.patch.keluarga_id && data.patch.keluarga_id !== before.keluarga_id) {
    const { data: keluarga, error: keErr } = await supabase
      .from("keluarga")
      .select("id, puskesmas_id")
      .eq("id", data.patch.keluarga_id)
      .maybeSingle();

    if (keErr) throw new Error(keErr.message);
    if (!keluarga) throw new Error("Keluarga tidak ditemukan atau tidak dalam lingkup Anda.");

    puskesmasIdToUpdate = keluarga.puskesmas_id;
  }

  const { data: row, error } = await supabase
    .from("kunjungan")
    .update({
      updated_by: userId,
      ...(data.patch.keluarga_id ? { keluarga_id: data.patch.keluarga_id } : {}),
      ...(puskesmasIdToUpdate ? { puskesmas_id: puskesmasIdToUpdate } : {}),
      ...(data.patch.jenis_kunjungan ? { jenis_kunjungan: data.patch.jenis_kunjungan } : {}),
      ...(data.patch.is_registered !== undefined ? { is_registered: data.patch.is_registered } : {}),
      ...(data.patch.tindakan ? { tindakan: data.patch.tindakan } : {}),
      ...(data.patch.catatan_awal !== undefined ? { catatan_awal: data.patch.catatan_awal || null } : {}),
      ...(data.patch.tanggal_kunjungan
        ? { tanggal_kunjungan: new Date(data.patch.tanggal_kunjungan).toISOString() }
        : {}),
    })
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const changed = before ? describeChanges(before as Record<string, unknown>, data.patch) : [];
  const desc = changed.length
    ? `Memperbarui ${changed.join(", ")} kunjungan ${row.kunjungan_code}.`
    : `Memperbarui kunjungan ${row.kunjungan_code}.`;

  await writeAudit({
    actorId: userId,
    action: "update",
    entity: "kunjungan",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: desc,
    metadata: { changed_fields: changed, after: data.patch },
  });

  return { kunjungan: row };
}

const updateTindakanKunjunganSchema = z.object({
  id: z.string().uuid(),
  tindakan: z.enum(["pengajuan", "disetujui", "proses", "selesai"]),
});

export type UpdateTindakanKunjunganInput = z.infer<typeof updateTindakanKunjunganSchema>;

export async function updateTindakanKunjungan(input: UpdateTindakanKunjunganInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = updateTindakanKunjunganSchema.parse(input);

  const { data: row, error } = await supabase
    .from("kunjungan")
    .update({ tindakan: data.tindakan, updated_by: userId })
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    action: "status_change",
    entity: "kunjungan",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: `Mengubah tindakan kunjungan ${row.kunjungan_code} menjadi ${data.tindakan}.`,
    metadata: { tindakan: data.tindakan },
  });

  return { kunjungan: row };
}

const softDeleteKunjunganSchema = z.object({ id: z.string().uuid() });

export type SoftDeleteKunjunganInput = z.infer<typeof softDeleteKunjunganSchema>;

export async function softDeleteKunjungan(input: SoftDeleteKunjunganInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = softDeleteKunjunganSchema.parse(input);

  const { data: row, error } = await supabase
    .from("kunjungan")
    .update({ 
      deleted_at: new Date().toISOString(), 
      deleted_by: userId 
      // Dihapus: status: "dibatalkan" agar tidak bentrok dengan enum database
    })
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    action: "delete",
    entity: "kunjungan",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: `Menghapus (soft) kunjungan ${row.kunjungan_code}.`,
  });

  return { ok: true };
}

const ajukanPerubahanJadwalSchema = z.object({
  id: z.string().uuid(),
  tanggalBaru: z.string().min(1),
});

export type AjukanPerubahanJadwalInput = z.infer<typeof ajukanPerubahanJadwalSchema>;

export async function ajukanPerubahanJadwal(input: AjukanPerubahanJadwalInput) {
  const { supabase } = await requireSupabaseAuth();
  const data = ajukanPerubahanJadwalSchema.parse(input);

  const { error } = await supabase.rpc("kunjungan_ubah_jadwal_keluarga", {
    _kunjungan_id: data.id,
    _tanggal_baru: new Date(data.tanggalBaru).toISOString(),
  });

  if (error) throw new Error(error.message);

  const { data: row, error: fetchError } = await supabase
    .from("kunjungan")
    .select("*")
    .eq("id", data.id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  return { kunjungan: row };
}