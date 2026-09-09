"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit, enrichAuditItems } from "@/src/lib/audit.server";

// Helper to check authentication and return client + user info
async function checkAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized: Silakan masuk terlebih dahulu");
  }
  return { supabase, user, userId: user.id };
}

async function assertRole(_supabase: any, userId: string, role: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  if (error) throw new Error("Gagal memverifikasi peran");
  return !!data;
}

const FIELD_LABEL: Record<string, string> = {
  jenis_kunjungan: "jenis kunjungan",
  perihal: "perihal",
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

function unpack(rawData: any) {
  return rawData && typeof rawData === "object" && "data" in rawData ? rawData.data : rawData;
}

export async function getKunjunganActivity(rawData: { kunjunganId: string; limit?: number }) {
  const { supabase } = await checkAuth();
  const input = z.object({
    kunjunganId: z.string().uuid(),
    limit: z.number().min(1).max(50).optional()
  }).parse(unpack(rawData));

  const limit = input.limit ?? 15;
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity", "kunjungan")
    .eq("entity_id", input.kunjunganId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const items = await enrichAuditItems(logs ?? []);
  return { items };
}

const createSchema = z.object({
  keluarga_id: z.string().uuid(),
  jenis_kunjungan: z.enum(["rumah", "puskesmas", "darurat"]).default("rumah"),
  perihal: z.string().trim().max(2000).optional().default(""),
  tanggal_kunjungan: z.string().min(1),
  // Status langsung -- lihat sipkesmas-rencana-revisi.md revisi terbaru:
  // kasus darurat/telat entry, staff bisa langsung set Terdaftar tanpa
  // menunggu Keluarga Ajukan Resmi.
  status: z.enum(["draft", "terdaftar"]).default("draft"),
  // Tanggal & jam dibuat -- default sekarang (server yang isi), TAPI kalau
  // staff sengaja mundurin ke hari sebelumnya (entry telat), field ini boleh
  // diisi manual dari client.
  dibuat_at: z.string().optional(),
});

export async function createKunjungan(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const data = createSchema.parse(unpack(rawData));

  const { data: keluarga, error: keErr } = await supabase
    .from("keluarga")
    .select("id, puskesmas_id, kepala_keluarga")
    .eq("id", data.keluarga_id)
    .maybeSingle();

  if (keErr) throw new Error(keErr.message);
  if (!keluarga) throw new Error("Keluarga tidak ditemukan atau tidak dalam lingkup Anda.");

  const now = new Date().toISOString();
  const isTerdaftarLangsung = data.status === "terdaftar";

  // Karena penomoran resmi (JNG-0001 dst) baru dihitung dan diberikan saat Tindak Lanjut 1
  // (tindakan='proses'), maka saat pengajuan dibuat, kita berikan kode sementara.
  // Nantinya tindak-lanjut.functions.ts akan otomatis mengganti DRAFT- ini dengan kode asli.
  const kunjunganCode = `DRAFT-${crypto.randomUUID()}`;

  const { data: row, error } = await supabase
    .from("kunjungan")
    .insert({
      keluarga_id: data.keluarga_id,
      puskesmas_id: keluarga.puskesmas_id,
      perawat_id: userId,
      jenis_kunjungan: data.jenis_kunjungan,
      perihal: data.perihal || null,
      tanggal_kunjungan: new Date(data.tanggal_kunjungan).toISOString(),
      created_at: data.dibuat_at ? new Date(data.dibuat_at).toISOString() : now,
      created_by: userId,
      updated_by: userId,
      kunjungan_code: kunjunganCode,
      // Status boleh Draft/Terdaftar, tetapi kode tetap sementara sampai TL1.
      is_registered: isTerdaftarLangsung,
      registered_at: isTerdaftarLangsung ? now : null,
      registered_by: isTerdaftarLangsung ? userId : null,
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
    metadata: { keluarga_id: row.keluarga_id, jenis: row.jenis_kunjungan, status_awal: data.status },
  });

  return { kunjungan: row };
}

export async function updateKunjungan(rawData: { id: string; patch: any }) {
  const { supabase, userId } = await checkAuth();
  const input = z.object({
    id: z.string().uuid(),
    patch: createSchema.partial(),
  }).parse(unpack(rawData));

  const { data: before } = await supabase.from("kunjungan").select("*").eq("id", input.id).maybeSingle();
  if (!before) throw new Error("Kunjungan tidak ditemukan");

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmas = await assertRole(supabase, userId, "admin_puskesmas");
  const isPerawat = await assertRole(supabase, userId, "perawat");

  if (!isDinkes) {
    if (before.tindakan !== "pengajuan") {
      throw new Error("Kunjungan tidak dapat diedit jika sudah dalam proses atau selesai");
    }
    if (isPerawat && before.registered_at) {
      throw new Error("Perawat tidak dapat mengedit kunjungan yang sudah terdaftar");
    }
  }

  const { data: row, error } = await supabase
    .from("kunjungan")
    .update({
      updated_by: userId,
      ...(input.patch.jenis_kunjungan ? { jenis_kunjungan: input.patch.jenis_kunjungan } : {}),
      ...(input.patch.perihal !== undefined ? { perihal: input.patch.perihal || null } : {}),
      ...(input.patch.tanggal_kunjungan
        ? { tanggal_kunjungan: new Date(input.patch.tanggal_kunjungan).toISOString() }
        : {}),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const changed = before ? describeChanges(before as Record<string, unknown>, input.patch) : [];
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
    metadata: { changed_fields: changed, after: input.patch },
  });

  return { kunjungan: row };
}

/**
 * @deprecated Status kunjungan (draft/terdaftar) sekarang HANYA berubah lewat
 * ajukanResmiKunjungan() di actions/workflow.ts (Keluarga saja, via RPC
 * kunjungan_ajukan_resmi). Fungsi ini dipertahankan sebentar cuma biar file
 * lama yang belum sempat diupdate tidak crash saat build — jangan dipakai
 * untuk kode baru.
 */
export async function updateKunjunganStatus(_rawData: { id: string; status: any }): Promise<never> {
  throw new Error(
    "updateKunjunganStatus sudah tidak dipakai. Pakai ajukanResmiKunjungan() dari actions/workflow.ts (hanya Keluarga).",
  );
}

/**
 * Keluarga mengajukan perubahan jadwal untuk kunjungan yang masih draft.
 * Lewat RPC kunjungan_ubah_jadwal_keluarga (SECURITY DEFINER) — divalidasi di
 * database: cuma role keluarga, cuma kunjungan miliknya, cuma selama draft.
 * Lihat supabase/migrations/20260719090000_fase3_ubah_jadwal_keluarga.sql
 */
export async function ajukanPerubahanJadwal(rawData: { id: string; tanggalBaru: string }) {
  const { supabase } = await checkAuth();
  const data = z.object({
    id: z.string().uuid(),
    tanggalBaru: z.string().min(1),
  }).parse(unpack(rawData));

  const { error } = await supabase.rpc("kunjungan_ubah_jadwal_keluarga", {
    _kunjungan_id: data.id,
    _tanggal_baru: new Date(data.tanggalBaru).toISOString(),
  });
  if (error) throw new Error(error.message);

  const { data: row, error: fetchError } = await supabase
    .from("kunjungan").select("*").eq("id", data.id).single();
  if (fetchError) throw new Error(fetchError.message);

  return { kunjungan: row };
}

/**
 * Keluarga menghapus pengajuan kunjungan yang masih draft (belum Ajukan Resmi).
 */
export async function hapusKunjunganKeluarga(rawData: { id: string }) {
  const { supabase } = await checkAuth();
  const data = z.object({ id: z.string().uuid() }).parse(unpack(rawData));

  const { error } = await supabase.rpc("kunjungan_hapus_keluarga", {
    _kunjungan_id: data.id,
  });
  if (error) throw new Error(error.message);

  return { ok: true };
}

export async function softDeleteKunjungan(rawData: { id: string }) {
  const { supabase, userId } = await checkAuth();
  const input = z.object({ id: z.string().uuid() }).parse(unpack(rawData));

  const { data: before } = await supabase.from("kunjungan").select("*").eq("id", input.id).maybeSingle();
  if (!before) throw new Error("Kunjungan tidak ditemukan");

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmas = await assertRole(supabase, userId, "admin_puskesmas");
  const isPerawat = await assertRole(supabase, userId, "perawat");

  if (!isDinkes) {
    if (before.tindakan !== "pengajuan") {
      throw new Error("Kunjungan tidak dapat dihapus jika sudah dalam proses atau selesai");
    }
    if (isPerawat && before.registered_at) {
      throw new Error("Perawat tidak dapat menghapus kunjungan yang sudah terdaftar");
    }
  }

  const { data: row, error } = await supabase
    .from("kunjungan")
    .update({ 
      deleted_at: new Date().toISOString(), 
      deleted_by: userId, 
      status: "dibatalkan",
      kunjungan_code: before.kunjungan_code?.startsWith("DRAFT-")
        ? "DEL-DRAF"
        : `DEL-${before.kunjungan_code}`,
    })
    .eq("id", input.id)
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

export async function hardDeleteKunjungan(rawData: { id: string }) {
  const { supabase, userId } = await checkAuth();
  const input = z.object({ id: z.string().uuid() }).parse(unpack(rawData));
  if (!(await assertRole(supabase, userId, "admin_dinkes"))) {
    throw new Error("Hapus permanen kunjungan hanya dapat dilakukan oleh Admin Dinkes");
  }

  const { data: row, error: fetchError } = await supabase
    .from("kunjungan")
    .select("id, kunjungan_code")
    .eq("id", input.id)
    .single();
  if (fetchError || !row) throw new Error(fetchError?.message ?? "Kunjungan tidak ditemukan");

  const { error: askepError } = await supabase
    .from("asuhan_keperawatan")
    .delete()
    .eq("kunjungan_id", input.id);
  if (askepError) throw new Error(`Gagal menghapus Askep terkait: ${askepError.message}`);

  const { error: teamError } = await supabase
    .from("kunjungan_tim")
    .delete()
    .eq("kunjungan_id", input.id);
  if (teamError) throw new Error(`Gagal menghapus tim kunjungan: ${teamError.message}`);

  const { error: deleteError } = await supabase.from("kunjungan").delete().eq("id", input.id);
  if (deleteError) throw new Error(deleteError.message);

  await writeAudit({
    actorId: userId,
    action: "delete",
    entity: "kunjungan",
    entityId: row.id,
    description: `Menghapus permanen kunjungan ${row.kunjungan_code}.`,
  });
  return { ok: true };
}

export async function bulkHardDeleteKunjungan(rawData: { ids: string[] }) {
  const { supabase, userId } = await checkAuth();
  const input = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(unpack(rawData));
  if (!(await assertRole(supabase, userId, "admin_dinkes"))) {
    throw new Error("Hapus permanen kunjungan hanya dapat dilakukan oleh Admin Dinkes");
  }

  const { data: rows, error: fetchError } = await supabase
    .from("kunjungan")
    .select("id")
    .in("id", input.ids);
  if (fetchError) throw new Error(fetchError.message);

  const { error: askepError } = await supabase.from("asuhan_keperawatan").delete().in("kunjungan_id", input.ids);
  if (askepError) throw new Error(`Gagal menghapus Askep terkait: ${askepError.message}`);
  const { error: teamError } = await supabase.from("kunjungan_tim").delete().in("kunjungan_id", input.ids);
  if (teamError) throw new Error(`Gagal menghapus tim kunjungan: ${teamError.message}`);
  const { error: deleteError } = await supabase.from("kunjungan").delete().in("id", input.ids);
  if (deleteError) throw new Error(deleteError.message);

  await writeAudit({
    actorId: userId,
    action: "delete",
    entity: "kunjungan",
    entityId: rows?.[0]?.id ?? input.ids[0],
    description: `Menghapus permanen ${rows?.length ?? input.ids.length} kunjungan secara massal.`,
  });
  return { ok: true };
}
