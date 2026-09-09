/**
 * Keluarga & Anggota Keluarga — server functions. RLS-aware via user-scoped supabase
 * client. Audit log ditulis via service role helper.
 */
"use server";

import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit, enrichAuditItems } from "@/lib/audit.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const getKeluargaActivitySchema = z.object({
  keluargaId: z.string().uuid(),
  limit: z.number().min(1).max(50).optional(),
});

export async function getKeluargaActivity(rawData: unknown) {
  const { supabase } = await requireSupabaseAuth();
  const data = getKeluargaActivitySchema.parse(rawData);
  const limit = data.limit ?? 15;

  const { data: kelLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity", "keluarga")
    .eq("entity_id", data.keluargaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data: anggotaLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity", "anggota_keluarga")
    .filter("metadata->>keluarga_id", "eq", data.keluargaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data: kunjungan } = await supabase
    .from("kunjungan")
    .select("id")
    .eq("keluarga_id", data.keluargaId);

  const kunjunganIds = (kunjungan ?? []).map((k) => k.id);
  type AuditRow = NonNullable<typeof kelLogs>[number];
  let kunjLogs: AuditRow[] = [];

  if (kunjunganIds.length) {
    const { data: kl } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("entity", "kunjungan")
      .in("entity_id", kunjunganIds)
      .order("created_at", { ascending: false })
      .limit(limit);
    kunjLogs = kl ?? [];
  }

  const rawItems = [...(kelLogs ?? []), ...(anggotaLogs ?? []), ...kunjLogs]
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, limit);

  const items = await enrichAuditItems(rawItems);
  return { items };
}

const keluargaInputSchema = z.object({
  nomor_kk: z.string().regex(/^[0-9]{16}$/, "Nomor KK harus 16 digit"),
  kepala_keluarga: z.string().trim().min(2).max(120),
  nik: z.string().regex(/^[0-9]{16}$/, "NIK harus 16 digit"),
  alamat: z.string().trim().max(500).optional().default(""),
  telepon: z
    .string()
    .trim()
    .regex(/^(\+62 8\d{7,13})?$/, "Format telepon tidak valid")
    .optional()
    .default(""),
  status: z.enum(["aktif", "nonaktif", "pindah", "meninggal"]).default("aktif"),
  puskesmas_id: z.string().uuid(),
});

const FIELD_LABEL: Record<string, string> = {
  nomor_kk: "nomor KK",
  kepala_keluarga: "nama kepala keluarga",
  nik: "NIK",
  alamat: "alamat",
  telepon: "telepon",
  status: "status",
};

async function getDuplicateLocationMessage(
  field: "nomor_kk" | "nik",
  duplicatePuskesmasId: string | null | undefined,
  currentPuskesmasId: string,
) {
  const label = field === "nomor_kk" ? "Nomor KK" : "NIK";
  if (!duplicatePuskesmasId || duplicatePuskesmasId === currentPuskesmasId) {
    return `${label} sudah terdaftar.`;
  }

  const { data: pusk } = await supabaseAdmin
    .from("puskesmas")
    .select("nama_puskesmas")
    .eq("id", duplicatePuskesmasId)
    .maybeSingle();
  return `${label} sudah terdaftar di ${pusk?.nama_puskesmas ?? "Puskesmas lain"}. Harap konfirmasi ke Puskesmas tersebut terlebih dahulu.`;
}

function describeChanges(
  before: Record<string, unknown>,
  patch: Record<string, unknown>
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

export async function createKeluarga(rawData: unknown) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = keluargaInputSchema.parse(rawData);

  const { data: duplicateKk } = await supabaseAdmin
    .from("keluarga")
    .select("id, puskesmas_id")
    .eq("nomor_kk", data.nomor_kk)
    .eq("status", "aktif")
    .is("deleted_at", null)
    .maybeSingle();
  if (duplicateKk) {
    throw new Error(await getDuplicateLocationMessage("nomor_kk", duplicateKk.puskesmas_id, data.puskesmas_id));
  }

  const { data: duplicateNik } = await supabaseAdmin
    .from("keluarga")
    .select("id, puskesmas_id")
    .eq("nik", data.nik)
    .eq("status", "aktif")
    .is("deleted_at", null)
    .maybeSingle();
  if (duplicateNik) {
    throw new Error(await getDuplicateLocationMessage("nik", duplicateNik.puskesmas_id, data.puskesmas_id));
  }

  const { data: row, error } = await supabase
    .from("keluarga")
    .insert({
      nomor_kk: data.nomor_kk,
      kepala_keluarga: data.kepala_keluarga,
      nik: data.nik,
      alamat: data.alamat || null,
      telepon: data.telepon || null,
      status: data.status,
      puskesmas_id: data.puskesmas_id,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    action: "create",
    entity: "keluarga",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: `Menambahkan keluarga ${row.kepala_keluarga} (${row.keluarga_code}).`,
  });

  return { keluarga: row };
}

const updateKeluargaSchema = z.object({
  id: z.string().uuid(),
  patch: keluargaInputSchema.partial(),
});

export async function updateKeluarga(rawData: unknown) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = updateKeluargaSchema.parse(rawData);

  if (data.patch.status === "aktif" || data.patch.nomor_kk || data.patch.nik) {
    const { data: current } = await supabase
      .from("keluarga")
      .select("nomor_kk, nik, puskesmas_id")
      .eq("id", data.id)
      .single();
    if (!current) throw new Error("Keluarga tidak ditemukan");

    const nomorKk = data.patch.nomor_kk ?? current.nomor_kk;
    const nik = data.patch.nik ?? current.nik;
    const { data: duplicateKk } = await supabaseAdmin
      .from("keluarga")
      .select("id, puskesmas_id")
      .neq("id", data.id)
      .eq("nomor_kk", nomorKk)
      .eq("status", "aktif")
      .is("deleted_at", null)
      .maybeSingle();
    if (duplicateKk) {
      throw new Error(await getDuplicateLocationMessage("nomor_kk", duplicateKk.puskesmas_id, current.puskesmas_id));
    }

    const { data: duplicateNik } = await supabaseAdmin
      .from("keluarga")
      .select("id, puskesmas_id")
      .neq("id", data.id)
      .eq("nik", nik)
      .eq("status", "aktif")
      .is("deleted_at", null)
      .maybeSingle();
    if (duplicateNik) {
      throw new Error(await getDuplicateLocationMessage("nik", duplicateNik.puskesmas_id, current.puskesmas_id));
    }
  }

  const { data: before } = await supabase
    .from("keluarga")
    .select("*")
    .eq("id", data.id)
    .maybeSingle();

  const { data: row, error } = await supabase
    .from("keluarga")
    .update({
      ...(data.patch.nomor_kk ? { nomor_kk: data.patch.nomor_kk } : {}),
      ...(data.patch.kepala_keluarga ? { kepala_keluarga: data.patch.kepala_keluarga } : {}),
      ...(data.patch.nik ? { nik: data.patch.nik } : {}),
      ...(data.patch.alamat !== undefined ? { alamat: data.patch.alamat || null } : {}),
      ...(data.patch.telepon !== undefined ? { telepon: data.patch.telepon || null } : {}),
      ...(data.patch.status ? { status: data.patch.status } : {}),
    })
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  if (data.patch.status && row.user_id) {
    const isActive = data.patch.status === "aktif";
    await supabaseAdmin.from("profiles").update({ is_active: isActive }).eq("id", row.user_id);
    await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      ban_duration: isActive ? "none" : "876000h",
    });
  }

  const changed = before ? describeChanges(before as Record<string, unknown>, data.patch) : [];
  const desc = changed.length
    ? `Memperbarui ${changed.join(", ")} keluarga ${row.kepala_keluarga}.`
    : `Memperbarui data keluarga ${row.kepala_keluarga} (${row.keluarga_code}).`;

  await writeAudit({
    actorId: userId,
    action: "update",
    entity: "keluarga",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: desc,
    metadata: { changed_fields: changed },
  });

  return { keluarga: row };
}

const softDeleteKeluargaSchema = z.object({ id: z.string().uuid() });

async function deleteFamilyAccount(userId: string) {
  const { error: rolesError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  if (rolesError) throw new Error(`Gagal menghapus role user keluarga: ${rolesError.message}`);

  const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (profileError) throw new Error(`Gagal menghapus profil user keluarga: ${profileError.message}`);

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError && authError.status !== 404) {
    throw new Error(`Gagal menghapus akun Auth keluarga: ${authError.message}`);
  }
}

async function requireDinkes(userId: string) {
  const { data: role, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin_dinkes")
    .maybeSingle();
  if (error) throw new Error(`Gagal memeriksa hak hapus permanen: ${error.message}`);
  if (!role) throw new Error("Hapus permanen hanya dapat dilakukan oleh Admin Dinkes");
}

export async function softDeleteKeluarga(rawData: unknown) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = softDeleteKeluargaSchema.parse(rawData);

  const { data: beforeDelete, error: beforeDeleteError } = await supabase
    .from("keluarga")
    .select("id, user_id")
    .eq("id", data.id)
    .single();
  if (beforeDeleteError || !beforeDelete) {
    throw new Error(beforeDeleteError?.message ?? "Keluarga tidak ditemukan");
  }

  const { data: row, error } = await supabase
    .from("keluarga")
    .update({ 
      deleted_at: new Date().toISOString(), 
      deleted_by: userId, 
      status: "nonaktif",
      keluarga_code: data.id ? undefined : undefined // We will update it below after fetching the original code for audit log
    })
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await cascadeDeleteKeluargaChildren(supabase, data.id);

  // The database trigger records the original code and assigns DELn-KODE atomically.
  const { error: unlinkError } = await supabase
    .from("keluarga")
    .update({ user_id: null })
    .eq("id", data.id);
  if (unlinkError) throw new Error(`Gagal memutus akun keluarga: ${unlinkError.message}`);

  if (beforeDelete.user_id) {
    await deleteFamilyAccount(beforeDelete.user_id);
  }

  await writeAudit({
    actorId: userId,
    action: "delete",
    entity: "keluarga",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: `Menghapus (soft) keluarga ${row.kepala_keluarga} (${row.keluarga_code}). Kode dan User telah dikosongkan.`,
  });

  return { ok: true };
}

const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()) });

export async function bulkSoftDeleteKeluarga(rawData: unknown) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = bulkIdsSchema.parse(rawData);

  if (data.ids.length === 0) return { ok: true };

  const { data: rows } = await supabase
    .from("keluarga")
    .select("id, keluarga_code, kepala_keluarga, user_id, puskesmas_id")
    .in("id", data.ids)
    .is("deleted_at", null);

  if (!rows || rows.length === 0) throw new Error("Keluarga tidak ditemukan");

  const now = new Date().toISOString();

  for (const row of rows) {
    const { error: softDeleteError } = await supabase
      .from("keluarga")
      .update({
        deleted_at: now,
        deleted_by: userId,
        status: "nonaktif",
      })
      .eq("id", row.id);
    if (softDeleteError) throw new Error(`Gagal mengarsipkan keluarga: ${softDeleteError.message}`);

    const { error: unlinkError } = await supabase
      .from("keluarga")
      .update({ user_id: null })
      .eq("id", row.id);
    if (unlinkError) throw new Error(`Gagal memutus akun keluarga: ${unlinkError.message}`);

    await cascadeDeleteKeluargaChildren(supabase, row.id);

    if (row.user_id) {
      await deleteFamilyAccount(row.user_id);
    }
  }

  await writeAudit({
    actorId: userId,
    action: "delete",
    entity: "keluarga",
    entityId: data.ids[0],
    description: `Menghapus (soft) ${rows.length} data keluarga secara massal.`,
  });

  return { ok: true };
}

/**
 * Helper: hapus semua child records terkait keluarga sebelum hard delete.
 * Urutan: kunjungan_tim → asuhan_keperawatan → kunjungan → anggota_keluarga
 */
async function cascadeDeleteKeluargaChildren(
  supabase: Awaited<ReturnType<typeof requireSupabaseAuth>>["supabase"],
  keluargaId: string,
) {
  const { data: kunjunganRows, error: kunjunganLookupError } = await supabaseAdmin
    .from("kunjungan")
    .select("id")
    .eq("keluarga_id", keluargaId);
  if (kunjunganLookupError) {
    throw new Error(`Gagal mencari kunjungan keluarga: ${kunjunganLookupError.message}`);
  }

  const kunjunganIds = (kunjunganRows ?? []).map((item) => item.id);
  if (kunjunganIds.length > 0) {
    const { error: timError } = await supabase.from("kunjungan_tim").delete().in("kunjungan_id", kunjunganIds);
    if (timError) throw new Error(`Gagal menghapus tim kunjungan: ${timError.message}`);

    const { error: askepError } = await supabase.from("asuhan_keperawatan").delete().in("kunjungan_id", kunjunganIds);
    if (askepError) throw new Error(`Gagal menghapus asuhan keperawatan: ${askepError.message}`);

    const { error: kunjunganError } = await supabase.from("kunjungan").delete().in("id", kunjunganIds);
    if (kunjunganError) throw new Error(`Gagal menghapus kunjungan keluarga: ${kunjunganError.message}`);
  }

  const { error: anggotaError } = await supabase.from("anggota_keluarga").delete().eq("keluarga_id", keluargaId);
  if (anggotaError) throw new Error(`Gagal menghapus anggota keluarga: ${anggotaError.message}`);
}

export async function hardDeleteKeluarga(rawData: unknown) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = softDeleteKeluargaSchema.parse(rawData);
  await requireDinkes(userId);

  // First fetch to get the code for audit log
  const { data: row } = await supabase
    .from("keluarga")
    .select("*")
    .eq("id", data.id)
    .single();

  if (!row) throw new Error("Keluarga tidak ditemukan");

  // Hapus semua child records terlebih dahulu (FK cascade manual)
  await cascadeDeleteKeluargaChildren(supabase, data.id);

  // Gunakan supabase (authenticated client) bukan supabaseAdmin untuk DELETE keluarga,
  // karena trigger keluarga_block_when_registered memanggil has_role() dan
  // service_role tidak punya EXECUTE permission pada fungsi tersebut.
  const { error } = await supabase
    .from("keluarga")
    .delete()
    .eq("id", data.id);

  if (error) throw new Error(error.message);

  if (row.user_id) {
    // Delete roles first to avoid FK constraint issues if ON DELETE CASCADE is not set
    await supabaseAdmin.from("user_roles").delete().eq("user_id", row.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", row.user_id);
    
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(row.user_id);
    if (authError) {
      console.error(`[hardDeleteKeluarga] Gagal menghapus user auth untuk keluarga ${data.id}:`, authError);
    }
  }

  await writeAudit({
    actorId: userId,
    action: "delete",
    entity: "keluarga",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: `Menghapus permanen keluarga ${row.kepala_keluarga} (${row.keluarga_code}).`,
  });

  return { ok: true };
}



export async function bulkHardDeleteKeluarga(rawData: unknown) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = bulkIdsSchema.parse(rawData);
  await requireDinkes(userId);

  if (data.ids.length === 0) return { ok: true };

  // Fetch all to get user_ids and audit info
  const { data: rows } = await supabase
    .from("keluarga")
    .select("id, keluarga_code, kepala_keluarga, user_id, puskesmas_id")
    .in("id", data.ids);

  if (!rows || rows.length === 0) throw new Error("Keluarga tidak ditemukan");

  // Hapus semua child records terlebih dahulu (FK cascade manual)
  for (const row of rows) {
    await cascadeDeleteKeluargaChildren(supabase, row.id);
  }

  // Gunakan supabase (authenticated client) bukan supabaseAdmin untuk DELETE keluarga,
  // karena trigger keluarga_block_when_registered memanggil has_role() dan
  // service_role tidak punya EXECUTE permission pada fungsi tersebut.
  const { error } = await supabase
    .from("keluarga")
    .delete()
    .in("id", data.ids);

  if (error) throw new Error(error.message);

  for (const row of rows) {
    if (row.user_id) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", row.user_id);
      await supabaseAdmin.from("profiles").delete().eq("id", row.user_id);
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(row.user_id);
      if (authError) {
        console.error(`[bulkHardDeleteKeluarga] Gagal menghapus user auth untuk keluarga ${row.id}:`, authError);
      }
    }
  }

  await writeAudit({
    actorId: userId,
    action: "delete",
    entity: "keluarga",
    entityId: data.ids[0], // Log against the first one, or use a generic system log
    description: `Menghapus permanen ${rows.length} data keluarga secara massal.`,
  });

  return { ok: true };
}

const anggotaInputSchema = z.object({
  keluarga_id: z.string().uuid(),
  nama: z.string().trim().min(2).max(120),
  nik: z.string().regex(/^([0-9]{16})?$/, "NIK harus 16 digit").optional().default(""),
  hubungan: z.enum(["Kepala Keluarga", "Istri", "Anak", "Orang Tua", "Lainnya"]),
  tanggal_lahir: z.string().optional().default(""),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
});

export async function createAnggota(rawData: unknown) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = anggotaInputSchema.parse(rawData);

  const { data: row, error } = await supabase
    .from("anggota_keluarga")
    .insert({
      keluarga_id: data.keluarga_id,
      nama: data.nama,
      nik: data.nik || null,
      hubungan: data.hubungan,
      tanggal_lahir: data.tanggal_lahir || null,
      jenis_kelamin: data.jenis_kelamin ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    action: "create",
    entity: "anggota_keluarga",
    entityId: row.id,
    description: `Menambahkan anggota keluarga ${row.nama}.`,
    metadata: { keluarga_id: row.keluarga_id },
  });

  return { anggota: row };
}

const updateAnggotaSchema = z.object({
  id: z.string().uuid(),
  patch: anggotaInputSchema.partial().omit({ keluarga_id: true }),
});

export async function updateAnggota(rawData: unknown) {
  const { supabase, userId } = await requireSupabaseAuth();
  const { id, patch } = updateAnggotaSchema.parse(rawData);

  const { data: row, error } = await supabase
    .from("anggota_keluarga")
    .update({
      ...patch,
      ...(patch.nik === "" ? { nik: null } : {}),
      ...(patch.tanggal_lahir === "" ? { tanggal_lahir: null } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    action: "update",
    entity: "anggota_keluarga",
    entityId: row.id,
    description: `Mengubah data anggota keluarga ${row.nama}.`,
    metadata: { keluarga_id: row.keluarga_id },
  });

  return { anggota: row };
}

const deleteAnggotaSchema = z.object({ id: z.string().uuid() });

export async function deleteAnggota(rawData: unknown) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = deleteAnggotaSchema.parse(rawData);

  const { data: row, error } = await supabase
    .from("anggota_keluarga")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    action: "delete",
    entity: "anggota_keluarga",
    entityId: row.id,
    description: `Menghapus anggota keluarga ${row.nama}.`,
    metadata: { keluarga_id: row.keluarga_id },
  });

  return { ok: true };
}