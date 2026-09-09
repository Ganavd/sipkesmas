/**
 * User management server functions — admin-only operations that require service role.
 * Authorization is enforced server-side via has_role() before any privileged action.
 */
"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit } from "@/lib/audit.server";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type DbClient = SupabaseClient<Database>;

const roleSchema = z.enum(["admin_dinkes", "admin_puskesmas", "perawat", "keluarga"]);

const createUserSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi").max(64),
  full_name: z.string().trim().max(120).optional().default(""),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^\+62 8\d{7,13}$/, "Format telepon harus +62 8XXX (tanpa 0 di depan)")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(128),
  role: roleSchema,
  puskesmas_id: z.string().uuid().nullable().optional(),
});

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

export type CreateUserInput = z.infer<typeof createUserSchema>;

export async function createUser(input: CreateUserInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = createUserSchema.parse(input);

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");

  if (!isDinkes && !isPuskesmasAdmin) {
    throw new Error("Anda tidak memiliki izin untuk membuat pengguna");
  }

  // Scope enforcement
  let puskesmasId: string | null = data.puskesmas_id ?? null;

  if (isPuskesmasAdmin && !isDinkes) {
    if (data.role === "admin_dinkes" || data.role === "admin_puskesmas") {
      throw new Error("Admin Puskesmas hanya dapat membuat Perawat atau Keluarga");
    }
    // Force to admin's own puskesmas
    const { data: ownPusk } = await supabase.rpc("get_user_puskesmas_id", { _user_id: userId });
    if (!ownPusk) {
      throw new Error("Profil Anda belum terhubung ke Puskesmas");
    }
    puskesmasId = ownPusk;
  } else if (isDinkes) {
    if (data.role !== "admin_dinkes" && !puskesmasId) {
      throw new Error("Puskesmas wajib dipilih untuk peran ini");
    }
    if (data.role === "admin_dinkes") {
      puskesmasId = null;
    }
  }

  // Check username uniqueness
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", data.username)
    .maybeSingle();

  if (existing) {
    throw new Error("Username sudah digunakan");
  }

  // FIX NAMA DEFAULT: Jika full_name tidak diisi, otomatis gunakan username
  const fullName = data.full_name?.trim() || data.username.trim();

  // Handle Email
  const userEmail = data.email && data.email.trim().length > 0 ? data.email.trim() : null;
  const internalEmailName = data.username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "") || "user";
  const authEmail = userEmail ?? `${internalEmailName}@sipkesmas.internal`;

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

  // Update email di tabel profiles jika diisi
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

export type ResetUserPasswordInput = z.infer<typeof resetPasswordSchema>;

export async function resetUserPassword(input: ResetUserPasswordInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = resetPasswordSchema.parse(input);

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");
  if (!isDinkes && !isPuskesmasAdmin) {
    throw new Error("Anda tidak memiliki izin");
  }

  // Puskesmas admin can only reset users in their own puskesmas
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

export type ToggleUserActiveInput = z.infer<typeof toggleActiveSchema>;

export async function toggleUserActive(input: ToggleUserActiveInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = toggleActiveSchema.parse(input);

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");
  if (!isDinkes && !isPuskesmasAdmin) {
    throw new Error("Anda tidak memiliki izin");
  }

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

const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(32),
  role: roleSchema,
  puskesmas_id: z.string().uuid().nullable(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export async function updateUser(input: UpdateUserInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = updateUserSchema.parse(input);

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");
  if (!isDinkes && !isPuskesmasAdmin) {
    throw new Error("Anda tidak memiliki izin");
  }

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

  const userEmail = data.email && data.email.trim().length > 0 ? data.email.trim() : null;

  const { error: profErr } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: data.full_name,
      email: userEmail,
      phone: data.phone,
      puskesmas_id: puskesmasId,
    })
    .eq("id", data.user_id);

  if (profErr) throw new Error(profErr.message);

  // Update role bila berubah
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

  // Sinkronkan email auth bila email diisi
  if (userEmail) {
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, { email: userEmail });
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

const deleteUserSchema = z.object({
  user_id: z.string().uuid(),
});

export type DeleteUserInput = z.infer<typeof deleteUserSchema>;

export async function deleteUser(input: DeleteUserInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = deleteUserSchema.parse(input);

  const isDinkes = await assertRole(supabase, userId, "admin_dinkes");
  const isPuskesmasAdmin = await assertRole(supabase, userId, "admin_puskesmas");
  if (!isDinkes && !isPuskesmasAdmin) {
    throw new Error("Anda tidak memiliki izin");
  }

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

  const { error: detachError } = await supabase
    .from("keluarga")
    .update({ user_id: null })
    .eq("user_id", data.user_id);

  if (detachError) {
    throw new Error("Gagal melepaskan relasi keluarga: " + detachError.message);
  }

  await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
  await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
  if (error) {
    throw new Error("Gagal menghapus pengguna di Auth: " + error.message);
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