"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const profileSchema = z.object({
  full_name: z.string().trim().min(3, "Nama lengkap minimal 3 karakter").max(120),
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter")
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung"),
  email: z.string().trim().email("Format email tidak valid").or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  new_password: z.string().min(8, "Password baru minimal 8 karakter").max(128).or(z.literal("")),
  avatar_data: z.string().optional(),
});

export type UpdateMyProfileInput = z.infer<typeof profileSchema>;

export async function updateMyProfile(input: UpdateMyProfileInput) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Sesi login tidak ditemukan");

  const data = profileSchema.parse(input);
  let avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  if (data.avatar_data) {
    const match = data.avatar_data.match(/^data:(image\/(?:jpeg|jpg|png));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) throw new Error("Foto profil harus berformat JPG, JPEG, atau PNG.");
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 2 * 1024 * 1024) throw new Error("Ukuran foto profil maksimal 2 MB.");
    const extension = match[1].toLowerCase().replace("jpeg", "jpg");
    const path = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("profile-avatars")
      .upload(path, buffer, { contentType: match[1].toLowerCase(), upsert: true, cacheControl: "3600" });
    if (uploadError) throw new Error(`Gagal mengunggah foto profil: ${uploadError.message}`);
    avatarUrl = supabaseAdmin.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl;
  }
  const { data: duplicate } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", data.username)
    .neq("id", user.id)
    .maybeSingle();
  if (duplicate) throw new Error("Username sudah digunakan oleh akun lain.");

  const nextEmail = data.email || `${data.username.toLowerCase()}@sipkesmas.internal`;
  const authUpdates: { email?: string; password?: string; user_metadata: Record<string, string> } = {
    user_metadata: {
      ...user.user_metadata,
      username: data.username,
      full_name: data.full_name,
      phone: data.phone ?? "",
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    },
  };
  if (nextEmail !== user.email) authUpdates.email = nextEmail;
  if (data.new_password) authUpdates.password = data.new_password;

  const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(user.id, authUpdates);
  if (updateAuthError) throw new Error(updateAuthError.message);

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: data.full_name,
      username: data.username,
      email: data.email || null,
      phone: data.phone || null,
    })
    .eq("id", user.id);
  if (profileError) throw new Error(profileError.message);

  return { ok: true };
}