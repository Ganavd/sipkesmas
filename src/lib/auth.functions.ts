/**
 * Auth-related server functions (callable without authentication).
 * - resolveEmailByUsername: lookup email for username-based login.
 * - bootstrapSuperAdmin: idempotent; creates initial Admin Dinkes if none exists.
 */
"use server";

import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const usernameSchema = z.object({
  username: z.string().trim().min(1).max(64),
});

export type ResolveEmailByUsernameInput = z.infer<typeof usernameSchema>;

export async function resolveEmailByUsername(input: ResolveEmailByUsernameInput) {
  const data = usernameSchema.parse(input);
    const { data: email, error } = await supabaseAdmin.rpc(
      "get_email_by_username",
      { _username: data.username }
    );

    if (error) {
      console.error("[auth] resolveEmailByUsername", error);
      throw new Error("Gagal memverifikasi username");
    }

    if (!email) {
      throw new Error("Username atau kata sandi salah");
    }

  return { email };
}

const SUPER_ADMIN_USERNAME = "timdoublea.developer";
const SUPER_ADMIN_EMAIL = "arganavd9@gmail.com";

export async function bootstrapSuperAdmin() {
  // Idempotent: only run if no admin_dinkes exists.
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin_dinkes");
    if (countErr) {
      console.error("[bootstrap] count admin_dinkes", countErr);
      throw new Error("Gagal memeriksa data admin");
    }
    if ((count ?? 0) > 0) {
      return { created: false, message: "Super Admin sudah tersedia" };
    }

    const password = process.env.SUPER_ADMIN_INITIAL_PASSWORD;
    if (!password) {
      throw new Error("Konfigurasi server belum lengkap (SUPER_ADMIN_INITIAL_PASSWORD)");
    }

    let userId: string | undefined;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "Tim Double A Developer",
        username: SUPER_ADMIN_USERNAME,
        role: "admin_dinkes",
      },
    });

    if (createErr) {
      const alreadyExists =
        createErr.message?.toLowerCase().includes("already") ||
        createErr.status === 422;
      if (!alreadyExists) {
        console.error("[bootstrap] createUser", createErr);
        throw new Error(createErr.message ?? "Gagal membuat Super Admin");
      }
      // User exists in auth.users but profile/role missing — recover.
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) {
        console.error("[bootstrap] listUsers", listErr);
        throw new Error("Gagal memulihkan akun Super Admin");
      }
      const existing = list.users.find((u) => u.email === SUPER_ADMIN_EMAIL);
      if (!existing) throw new Error("Akun Super Admin tidak ditemukan untuk dipulihkan");
      userId = existing.id;

      // Reset password to match the configured secret.
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          full_name: "Tim Double A Developer",
          username: SUPER_ADMIN_USERNAME,
          role: "admin_dinkes",
        },
      });
      if (updErr) {
        console.error("[bootstrap] updateUser", updErr);
        throw new Error("Gagal memperbarui kata sandi Super Admin");
      }
    } else {
      userId = created.user?.id;
    }

    if (!userId) throw new Error("Gagal memperoleh ID Super Admin");

    // Ensure profile row exists (trigger may not have fired on a pre-existing user).
    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: "Tim Double A Developer",
        username: SUPER_ADMIN_USERNAME,
        email: SUPER_ADMIN_EMAIL,
        is_active: true,
      },
      { onConflict: "id" },
    );
    if (profileErr) {
      console.error("[bootstrap] upsert profile", profileErr);
      throw new Error("Gagal membuat profil Super Admin");
    }

    // Ensure role row exists (and is admin_dinkes). UNIQUE(user_id) prevents duplicates.
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "admin_dinkes" },
        { onConflict: "user_id" },
      );
    if (roleErr) {
      console.error("[bootstrap] upsert role", roleErr);
      throw new Error("Gagal menetapkan peran Super Admin");
    }

  return {
    created: true,
    message: `Super Admin siap. Login dengan username: ${SUPER_ADMIN_USERNAME}`,
  };
}
