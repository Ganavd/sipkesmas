"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { writeAudit, enrichAuditItems } from "@/src/lib/audit.server";
import {
  hardDeleteKeluarga as hardDeleteKeluargaImpl,
  bulkHardDeleteKeluarga as bulkHardDeleteKeluargaImpl,
} from "@/src/lib/keluarga.functions";

export async function hardDeleteKeluarga(rawData: unknown) {
  return hardDeleteKeluargaImpl(rawData);
}

export async function bulkHardDeleteKeluarga(rawData: unknown) {
  return bulkHardDeleteKeluargaImpl(rawData);
}

// Helper to check authentication and return client + user info
async function checkAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized: Silakan masuk terlebih dahulu");
  }
  return { supabase, user, userId: user.id };
}

function unpack(rawData: any) {
  return rawData && typeof rawData === "object" && "data" in rawData ? rawData.data : rawData;
}

function duplicateKeluargaMessage(error: { code?: string; constraint?: string; message?: string }) {
  if (error.constraint === "keluarga_nomor_kk_unique") {
    return "Nomor KK sudah terdaftar pada keluarga lain, termasuk jika berada di Puskesmas berbeda.";
  }
  if (error.constraint === "keluarga_nik_unique") {
    return "NIK kepala keluarga sudah terdaftar pada keluarga lain.";
  }
  if (error.code === "23505" && error.constraint?.toLowerCase().includes("username")) {
    return "Username sudah digunakan oleh akun lain.";
  }
  return error.code === "23505" ? "Data yang dimasukkan sudah digunakan oleh data lain." : error.message ?? "Gagal menyimpan keluarga";
}

async function removeFamilyAccountById(userId: string) {
  const { error: rolesError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  if (rolesError) throw new Error(`Gagal membersihkan role akun keluarga: ${rolesError.message}`);

  const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (profileError) throw new Error(`Gagal membersihkan profil akun keluarga: ${profileError.message}`);

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError && authError.status !== 404) {
    throw new Error(`Gagal membersihkan akun Auth keluarga: ${authError.message}`);
  }
}

export async function getKeluargaActivity(rawData: { keluargaId: string; limit?: number }) {
  const { supabase } = await checkAuth();
  const input = z.object({
    keluargaId: z.string().uuid(),
    limit: z.number().min(1).max(50).optional()
  }).parse(unpack(rawData));

  const limit = input.limit ?? 15;

  // Ambil audit log untuk keluarga ini + anggota + kunjungan terkait.
  const { data: kelLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity", "keluarga")
    .eq("entity_id", input.keluargaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data: kunjungan } = await supabase
    .from("kunjungan")
    .select("id")
    .eq("keluarga_id", input.keluargaId);

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

  const rawItems = [...(kelLogs ?? []), ...kunjLogs]
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, limit);

  const items = await enrichAuditItems(rawItems);
  return { items };
}

import { supabaseAdmin } from "@/lib/supabase/admin";

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
  username: z.string().optional(),
  password: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

function toTitleCaseNoSpace(str: string): string {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

async function getDuplicateLocationMessage(
  field: string,
  duplicatePuskesmasId: string | null | undefined,
  currentPuskesmasId: string,
) {
  const label = field === "nomor_kk" ? "Nomor KK" : field === "nik" ? "NIK" : "Username";
  if (!duplicatePuskesmasId || duplicatePuskesmasId === currentPuskesmasId) {
    return `${label} sudah terdaftar.`;
  }

  const { data: pusk } = await supabaseAdmin
    .from("puskesmas")
    .select("nama_puskesmas")
    .eq("id", duplicatePuskesmasId)
    .maybeSingle();
  const puskName = pusk?.nama_puskesmas ?? "Puskesmas lain";
  return `${label} sudah terdaftar di ${puskName}. Harap konfirmasi ke Puskesmas tersebut terlebih dahulu.`;
}

async function removeOrphanedFamilyAccount(username: string) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (profileError) throw new Error(`Gagal memeriksa akun lama keluarga: ${profileError.message}`);
  if (!profile) return false;

  const { data: activeFamily, error: familyError } = await supabaseAdmin
    .from("keluarga")
    .select("id")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (familyError) throw new Error(`Gagal memeriksa relasi akun keluarga: ${familyError.message}`);
  if (activeFamily) return false;

  const { data: familyRole, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", profile.id)
    .eq("role", "keluarga")
    .maybeSingle();
  if (roleError) throw new Error(`Gagal memeriksa peran akun keluarga: ${roleError.message}`);
  if (!familyRole) return false;

  const { error: rolesDeleteError } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", profile.id);
  if (rolesDeleteError) throw new Error(`Gagal menghapus peran akun lama: ${rolesDeleteError.message}`);

  const { error: profileDeleteError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", profile.id);
  if (profileDeleteError) throw new Error(`Gagal menghapus profil akun lama: ${profileDeleteError.message}`);

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
  if (authDeleteError && authDeleteError.status !== 404) {
    throw new Error(`Gagal menghapus akun Auth lama: ${authDeleteError.message}`);
  }
  return true;
}

const FIELD_LABEL: Record<string, string> = {
  nomor_kk: "nomor KK",
  kepala_keluarga: "nama kepala keluarga",
  nik: "NIK",
  alamat: "alamat",
  telepon: "telepon",
  status: "status",
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

export async function createKeluarga(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const data = keluargaInputSchema.parse(unpack(rawData));

  // Ambil info puskesmas
  const { data: pusk } = await supabase
    .from("puskesmas")
    .select("kode, nama_puskesmas")
    .eq("id", data.puskesmas_id)
    .maybeSingle();

  const puskKode = pusk?.kode ? pusk.kode.toUpperCase() : "PKM";

  // Ambil semua keluarga_code aktif di puskesmas ini untuk generate urutan dinamis (gap-filling)
  const { data: existingCodesData } = await supabase
    .from("keluarga")
    .select("keluarga_code")
    .eq("puskesmas_id", data.puskesmas_id);
    
  const existingCodes = (existingCodesData ?? [])
    .map((d) => d.keluarga_code)
    .filter((code): code is string => Boolean(code) && !/^DEL(?:\d+|-)/i.test(code));
  const nums: number[] = [];
  for (const code of existingCodes) {
    if (!code) continue;
    const parts = code.split('-');
    const numStr = parts[parts.length - 1];
    const n = parseInt(numStr, 10);
    if (!isNaN(n)) nums.push(n);
  }
  const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
  
  let nextIndex = 1;
  for (let i = 1; i <= maxNum + 1; i++) {
    if (!nums.includes(i)) {
      nextIndex = i;
      break;
    }
  }

  const seq = String(nextIndex).padStart(4, "0");
  const keluargaCode = `${puskKode}-${seq}`;
  const defaultUsername = (data.username || `${seq}Keluarga${puskKode}`).trim();
  if (!/^[A-Za-z0-9._-]+$/.test(defaultUsername)) {
    throw new Error("Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung");
  }

  await removeOrphanedFamilyAccount(defaultUsername);

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

  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from("profiles")
    .select("id, puskesmas_id")
    .ilike("username", defaultUsername)
    .maybeSingle();
  if (profileLookupError) {
    throw new Error(`Gagal memeriksa username keluarga: ${profileLookupError.message}`);
  }
  if (existingProfile) {
    throw new Error(await getDuplicateLocationMessage("username", existingProfile.puskesmas_id, data.puskesmas_id));
  }
  
  // Title case tanpa spasi dari Nama Kepala Keluarga
  const basePass = toTitleCaseNoSpace(data.kepala_keluarga);
  const defaultPassword = data.password || (basePass.length < 6 ? `${basePass}123` : basePass);

  const authEmail = data.email && data.email.trim() !== ""
    ? data.email.trim()
    : `${defaultUsername.toLowerCase()}@sipkesmas.internal`;

  const fullName = data.full_name && data.full_name.trim() !== ""
    ? data.full_name.trim()
    : data.kepala_keluarga;

  const userPhone = data.phone && data.phone.trim() !== ""
    ? data.phone.trim()
    : data.telepon || null;

  // 1. Buat User Auth untuk Keluarga
  const { data: createdUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username: defaultUsername,
      role: "keluarga",
      puskesmas_id: data.puskesmas_id,
      phone: userPhone,
    },
  });

  if (createAuthErr || !createdUser?.user) {
    const authError = createAuthErr as (Error & {
      code?: string;
      status?: number;
      details?: string;
      hint?: string;
    }) | null;
    console.error("[createKeluarga] Auth user creation failed", {
      message: authError?.message,
      code: authError?.code,
      status: authError?.status,
      details: authError?.details,
      hint: authError?.hint,
      email: authEmail,
      username: defaultUsername,
    });
    throw new Error(
      authError?.message ||
        authError?.details ||
        `Gagal membuat akun user keluarga untuk ${authEmail} (Auth ${authError?.status ?? "error"})`,
    );
  }

  const createdUserId = createdUser.user.id;
  const now = new Date().toISOString();

  // 2. Assign role keluarga di user_roles
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: createdUserId, role: "keluarga" }, { onConflict: "user_id" });

  // 3. Simpan data Keluarga di DB dengan user_id yang tertaut
  const { data: row, error } = await supabase
    .from("keluarga")
    .insert({
      nomor_kk: data.nomor_kk,
      kepala_keluarga: data.kepala_keluarga,
      nik: data.nik,
      alamat: data.alamat || null,
      telepon: data.telepon || null,
      status: "aktif",
      puskesmas_id: data.puskesmas_id,
      user_id: createdUserId,
      created_by: userId,
      keluarga_code: keluargaCode,
      is_registered: true,
      workflow_status: "registered",
      registered_at: now,
      registered_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    await removeFamilyAccountById(createdUserId);
    throw new Error(duplicateKeluargaMessage(error));
  }

  await writeAudit({
    actorId: userId,
    action: "create",
    entity: "keluarga",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: `Menambahkan keluarga ${row.kepala_keluarga} (${row.keluarga_code}) sekaligus akun pengguna ${defaultUsername}.`,
  });

  return { keluarga: row, username: defaultUsername, password: defaultPassword };
}

export async function updateKeluarga(rawData: { id: string; patch: any }) {
  const { supabase, userId } = await checkAuth();
  const input = z.object({
    id: z.string().uuid(),
    patch: keluargaInputSchema.partial()
  }).parse(unpack(rawData));

  if (input.patch.status === "aktif" || input.patch.nomor_kk || input.patch.nik) {
    const { data: current } = await supabase
      .from("keluarga")
      .select("nomor_kk, nik, puskesmas_id")
      .eq("id", input.id)
      .single();
    if (!current) throw new Error("Keluarga tidak ditemukan");

    const nomorKk = input.patch.nomor_kk ?? current.nomor_kk;
    const nik = input.patch.nik ?? current.nik;
    const { data: duplicate } = await supabaseAdmin
      .from("keluarga")
      .select("id, nomor_kk, nik, puskesmas_id")
      .neq("id", input.id)
      .eq("status", "aktif")
      .is("deleted_at", null)
      .or(`nomor_kk.eq.${nomorKk},nik.eq.${nik}`)
      .maybeSingle();
    if (duplicate?.nomor_kk === nomorKk) {
      throw new Error(await getDuplicateLocationMessage("nomor_kk", duplicate.puskesmas_id, current.puskesmas_id));
    }
    if (duplicate?.nik === nik) {
      throw new Error(await getDuplicateLocationMessage("nik", duplicate.puskesmas_id, current.puskesmas_id));
    }
  }

  const { data: before } = await supabase.from("keluarga").select("*").eq("id", input.id).maybeSingle();

  const { data: row, error } = await supabase
    .from("keluarga")
    .update({
      ...(input.patch.nomor_kk ? { nomor_kk: input.patch.nomor_kk } : {}),
      ...(input.patch.kepala_keluarga ? { kepala_keluarga: input.patch.kepala_keluarga } : {}),
      ...(input.patch.nik ? { nik: input.patch.nik } : {}),
      ...(input.patch.alamat !== undefined ? { alamat: input.patch.alamat || null } : {}),
      ...(input.patch.telepon !== undefined ? { telepon: input.patch.telepon || null } : {}),
      ...(input.patch.status ? { status: input.patch.status } : {}),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  if (input.patch.status && row.user_id) {
    const isActive = input.patch.status === "aktif";
    await supabaseAdmin.from("profiles").update({ is_active: isActive }).eq("id", row.user_id);
    await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      ban_duration: isActive ? "none" : "876000h",
    });
  }

  const changed = before ? describeChanges(before as Record<string, unknown>, input.patch) : [];
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

export async function softDeleteKeluarga(rawData: { id: string }) {
  const { supabase, userId } = await checkAuth();
  const input = z.object({ id: z.string().uuid() }).parse(unpack(rawData));

  const { data: row, error } = await supabase
    .from("keluarga")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId, status: "nonaktif" })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    action: "delete",
    entity: "keluarga",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: `Menghapus (soft) keluarga ${row.kepala_keluarga} (${row.keluarga_code}).`,
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
  const { supabase, userId } = await checkAuth();
  const data = anggotaInputSchema.parse(unpack(rawData));

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

export async function updateAnggota(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const input = z.object({
    id: z.string().uuid(),
    patch: anggotaInputSchema.partial().omit({ keluarga_id: true }),
  }).parse(unpack(rawData));

  const { data: row, error } = await supabase
    .from("anggota_keluarga")
    .update({
      ...input.patch,
      ...(input.patch.nik === "" ? { nik: null } : {}),
      ...(input.patch.tanggal_lahir === "" ? { tanggal_lahir: null } : {}),
    })
    .eq("id", input.id)
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

export async function deleteAnggota(rawData: { id: string }) {
  const { supabase, userId } = await checkAuth();
  const input = z.object({ id: z.string().uuid() }).parse(unpack(rawData));

  const { data: row, error } = await supabase
    .from("anggota_keluarga")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", input.id)
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

const updateKeluargaUserInfoSchema = z.object({
  keluarga_id: z.string().uuid(),
  username: z.string().min(3),
  full_name: z.string().min(3),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

export async function updateKeluargaUserInfo(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const data = updateKeluargaUserInfoSchema.parse(unpack(rawData));

  // Ambil user_id dari keluarga
  const { data: k } = await supabase
    .from("keluarga")
    .select("user_id, puskesmas_id")
    .eq("id", data.keluarga_id)
    .single();
  if (!k || !k.user_id) throw new Error("Akun keluarga tidak ditemukan");

  const { data: duplicateUsername } = await supabaseAdmin
    .from("profiles")
    .select("id, puskesmas_id")
    .ilike("username", data.username)
    .neq("id", k.user_id)
    .maybeSingle();
  if (duplicateUsername) {
    throw new Error(await getDuplicateLocationMessage("username", duplicateUsername.puskesmas_id, k.puskesmas_id));
  }

  // Update Auth Email & User Metadata
  const updates: any = { user_metadata: { username: data.username, full_name: data.full_name, phone: data.phone } };
  if (data.email) updates.email = data.email;
  
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(k.user_id, updates);
  if (updateErr) throw new Error(updateErr.message);

  // Update Profiles
  const { error: profileError } = await supabaseAdmin.from("profiles").update({
    username: data.username,
    full_name: data.full_name,
    email: data.email || null,
    phone: data.phone || null,
  }).eq("id", k.user_id);
  if (profileError) throw new Error(duplicateKeluargaMessage(profileError));

  await writeAudit({
    actorId: userId,
    action: "update",
    entity: "keluarga_auth",
    entityId: data.keluarga_id,
    description: "Mengubah informasi user keluarga",
  });

  return { ok: true };
}

const updateKeluargaPasswordSchema = z.object({
  keluarga_id: z.string().uuid(),
  old_password: z.string().min(6, "Password lama minimal 6 karakter"),
  new_password: z.string().min(6, "Password baru minimal 6 karakter"),
});

export async function updateKeluargaPassword(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const data = updateKeluargaPasswordSchema.parse(unpack(rawData));

  if (data.old_password === data.new_password) {
    throw new Error("Password baru tidak boleh sama dengan password lama");
  }

  // Ambil user_id dan email dari keluarga
  const { data: k } = await supabase.from("keluarga").select("user_id").eq("id", data.keluarga_id).single();
  if (!k || !k.user_id) throw new Error("Akun keluarga tidak ditemukan");

  const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("id", k.user_id).single();
  if (!prof || !prof.email) throw new Error("Email tidak ditemukan");

  // Verifikasi password lama dengan membuat client anonim
  const { createClient } = await import("@supabase/supabase-js");
  const anonClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error: signInErr } = await anonClient.auth.signInWithPassword({
    email: prof.email,
    password: data.old_password,
  });

  if (signInErr) {
    throw new Error("Password lama salah");
  }

  // Jika benar, update password via Admin
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(k.user_id, { password: data.new_password });
  if (updateErr) throw new Error(updateErr.message);

  await writeAudit({
    actorId: userId,
    action: "update",
    entity: "keluarga_auth",
    entityId: data.keluarga_id,
    description: "Mengubah password akun keluarga",
  });

  return { ok: true };
}
