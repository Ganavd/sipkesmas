"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit } from "@/src/lib/audit.server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type DbClient = SupabaseClient<Database>;

const roleSchema = z.enum(["admin_dinkes", "admin_puskesmas", "perawat", "keluarga"]);

const createUserSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi").max(64),
  full_name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email("Format email tidak valid").max(255).optional().or(z.literal("")).optional(),
  phone: z.string().trim().regex(/^\+62 8\d{7,13}$/, "Format telepon harus +62 8XXX (tanpa 0 di depan)").optional().or(z.literal("")).optional(),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(128),
  role: roleSchema,
  puskesmas_id: z.string().uuid().nullable().optional(),
});

async function checkAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return { supabase: supabase as unknown as DbClient, userId: user.id };
}

async function assertRole(_supabase: DbClient, userId: string, role: AppRole): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  if (error) throw new Error("Gagal memverifikasi peran");
  return !!data;
}

function unpack(rawData: any) {
  return rawData && typeof rawData === "object" && "data" in rawData ? rawData.data : rawData;
}

export async function createUser(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const data = createUserSchema.parse(unpack(rawData));

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");

  if (!isDinkes && !isPuskesmasAdmin) {
    throw new Error("Anda tidak memiliki izin untuk membuat pengguna");
  }

  let puskesmasId: string | null = data.puskesmas_id ?? null;

  if (isPuskesmasAdmin && !isDinkes) {
    if (data.role === "admin_dinkes" || data.role === "admin_puskesmas") {
      throw new Error("Admin Puskesmas hanya dapat membuat Perawat atau Keluarga");
    }
    const { data: ownPusk } = await supabase.rpc("get_user_puskesmas_id", { _user_id: userId });
    if (!ownPusk) throw new Error("Profil Anda belum terhubung ke Puskesmas");
    puskesmasId = ownPusk;
  } else if (isDinkes) {
    if (data.role !== "admin_dinkes" && !puskesmasId) {
      throw new Error("Puskesmas wajib dipilih untuk peran ini");
    }
    if (data.role === "admin_dinkes") puskesmasId = null;
  }

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", data.username)
    .maybeSingle();
  if (existing) throw new Error("Username sudah digunakan");

  // Jika full_name kosong, gunakan username sebagai nama default
  const trimmedUsername = data.username.trim();
  const defaultName = trimmedUsername.charAt(0).toUpperCase() + trimmedUsername.slice(1);

  const fullName = data.full_name?.trim() || defaultName;

  // 1. Ambil email jika diisi (jika kosong, jadikan null)
  const userEmail = data.email && data.email.trim().length > 0 ? data.email.trim() : null;

  // 2. Tentukan email untuk autentikasi (gunakan email internal jika kosong)
  const internalEmailName = data.username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "") || "user";
  const authEmail = userEmail ?? `${internalEmailName}@sipkesmas.internal`;

  // 3. Buat user di Supabase Auth
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username: data.username,
      phone: data.phone ?? "",
      role: data.role,
      puskesmas_id: puskesmasId,
    },
  });

  if (createErr || !created.user) {
    console.error("[createUser] auth.admin.createUser", createErr);
    throw new Error(createErr?.message ?? "Gagal membuat pengguna");
  }

  // 4. Update tabel profiles HANYA jika ada userEmail (tanpa email_konfirmasi)
  if (userEmail) {
    await supabaseAdmin
      .from("profiles")
      .update({ email: userEmail })
      .eq("id", created.user.id);
  }

  return { id: created.user.id, username: data.username, full_name: fullName };
}
const resetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(8).max(128),
});

export async function resetUserPassword(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const data = resetPasswordSchema.parse(unpack(rawData));

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");
  if (!isDinkes && !isPuskesmasAdmin) throw new Error("Anda tidak memiliki izin");

  if (!isDinkes && isPuskesmasAdmin) {
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("puskesmas_id")
      .eq("id", data.user_id)
      .maybeSingle();
    const { data: own } = await supabase.rpc("get_user_puskesmas_id", { _user_id: userId });
    if (!target || target.puskesmas_id !== own) {
      throw new Error("Tidak boleh mengubah pengguna di luar Puskesmas Anda");
    }
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
    password: data.new_password,
  });
  if (error) throw new Error(error.message);

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("full_name, username, puskesmas_id")
    .eq("id", data.user_id)
    .maybeSingle();

  await writeAudit({
    actorId: userId,
    action: "reset_password",
    entity: "user",
    entityId: data.user_id,
    puskesmasId: target?.puskesmas_id ?? null,
    description: `Mereset kata sandi ${target?.full_name ?? target?.username ?? "pengguna"}`,
  });

  return { ok: true };
}

const toggleActiveSchema = z.object({
  user_id: z.string().uuid(),
  is_active: z.boolean(),
});

export async function toggleUserActive(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const data = toggleActiveSchema.parse(unpack(rawData));

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");
  if (!isDinkes && !isPuskesmasAdmin) throw new Error("Anda tidak memiliki izin");

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("full_name, username, puskesmas_id")
    .eq("id", data.user_id)
    .maybeSingle();

  if (!isDinkes && isPuskesmasAdmin) {
    const { data: own } = await supabase.rpc("get_user_puskesmas_id", { _user_id: userId });
    if (!target || target.puskesmas_id !== own) {
      throw new Error("Tidak boleh mengubah pengguna di luar Puskesmas Anda");
    }
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_active: data.is_active })
    .eq("id", data.user_id);
  if (error) throw new Error(error.message);

  // Sync status keluarga
  await supabaseAdmin
    .from("keluarga")
    .update({ status: data.is_active ? "aktif" : "nonaktif" })
    .eq("user_id", data.user_id);

  await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
    ban_duration: data.is_active ? "none" : "876000h",
  });

  await writeAudit({
    actorId: userId,
    action: data.is_active ? "activate_user" : "deactivate_user",
    entity: "user",
    entityId: data.user_id,
    puskesmasId: target?.puskesmas_id ?? null,
    description: `${data.is_active ? "Mengaktifkan" : "Menonaktifkan"} ${target?.full_name ?? target?.username ?? "pengguna"}`,
  });

  return { ok: true };
}

const deleteUserSchema = z.object({
  user_id: z.string().uuid(),
});

export async function deleteUser(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const data = deleteUserSchema.parse(unpack(rawData));

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");
  if (!isDinkes && !isPuskesmasAdmin) throw new Error("Anda tidak memiliki izin");

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("puskesmas_id, full_name, username")
    .eq("id", data.user_id)
    .maybeSingle();

  if (!target) throw new Error("Pengguna tidak ditemukan");

  if (!isDinkes && isPuskesmasAdmin) {
    const { data: own } = await supabase.rpc("get_user_puskesmas_id", { _user_id: userId });
    if (target.puskesmas_id !== own) {
      throw new Error("Tidak boleh menghapus pengguna di luar Puskesmas Anda");
    }
  }

  // 1. Lepaskan relasi keluarga jika ada menggunakan client terautentikasi (agar trigger RLS lolos)
  const { error: detachError } = await supabase
    .from("keluarga")
    .update({ user_id: null })
    .eq("user_id", data.user_id);

  if (detachError) {
    throw new Error("Gagal melepaskan relasi keluarga: " + detachError.message);
  }

  // 2. Hapus roles
  await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", data.user_id);

  // 3. Hapus profile
  await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", data.user_id);

  // 4. Hapus auth user
  const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
  if (error) {
    const errObj = typeof error === 'object' && error !== null ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error);
    throw new Error("Gagal menghapus pengguna di Auth: " + errObj);
  }

  await writeAudit({
    actorId: userId,
    action: "delete_user",
    entity: "user",
    entityId: data.user_id,
    puskesmasId: target.puskesmas_id ?? null,
    description: `Menghapus permanen pengguna ${target.full_name ?? target.username}`,
  });

  return { ok: true };
}

const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).nullable(),
  phone: z.string().trim().max(32),
  role: roleSchema,
  puskesmas_id: z.string().uuid().nullable(),
});

export async function updateUser(rawData: unknown) {
  const { supabase, userId } = await checkAuth();
  const data = updateUserSchema.parse(unpack(rawData));

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");
  if (!isDinkes && !isPuskesmasAdmin) throw new Error("Anda tidak memiliki izin");

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("full_name, username, puskesmas_id")
    .eq("id", data.user_id)
    .maybeSingle();
  if (!target) throw new Error("Pengguna tidak ditemukan");

  let puskesmasId = data.puskesmas_id;

  if (!isDinkes && isPuskesmasAdmin) {
    if (data.role === "admin_dinkes" || data.role === "admin_puskesmas") {
      throw new Error("Admin Puskesmas tidak dapat mengubah peran ini");
    }
    const { data: own } = await supabase.rpc("get_user_puskesmas_id", { _user_id: userId });
    if (target.puskesmas_id !== own) {
      throw new Error("Tidak boleh mengubah pengguna di luar Puskesmas Anda");
    }
    puskesmasId = own ?? null;
  } else if (isDinkes) {
    if (data.role === "admin_dinkes") {
      puskesmasId = null;
    } else if (!puskesmasId) {
      throw new Error("Puskesmas wajib dipilih untuk peran ini");
    }
  }

  const { error: profErr } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      puskesmas_id: puskesmasId,
    })
    .eq("id", data.user_id);
  if (profErr) throw new Error(profErr.message);

  const { data: currentRoleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user_id)
    .maybeSingle();

  if (currentRoleRow?.role !== data.role) {
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id" });
    if (roleErr) throw new Error(roleErr.message);
  }

  if (data.email) {
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, { email: data.email });
  }
  await writeAudit({
    actorId: userId,
    action: "update_user",
    entity: "user",
    entityId: data.user_id,
    puskesmasId,
    description: `Memperbarui data ${data.full_name}`,
    metadata: { previous_role: currentRoleRow?.role ?? null, new_role: data.role },
  });

  return { ok: true };
}
