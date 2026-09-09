"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/src/integrations/supabase/client.server";

const usernameSchema = z.object({
  username: z.string().trim().min(1).max(64),
});

/**
 * Mengonversi username dari form login menjadi email yang terdaftar di Supabase Auth.
 * Jika user mendaftar tanpa email, otomatis menggunakan format internal (@sipkesmas.internal).
 */
export async function resolveEmailByUsername(rawData: unknown) {
  const data = usernameSchema.parse(rawData);
  const cleanUsername = data.username.toLowerCase();

  // 1. Cek di DB via RPC apakah user mendaftar menggunakan email asli
  const { data: emailFromRpc, error } = await supabaseAdmin.rpc(
    "get_email_by_username",
    { _username: cleanUsername }
  );

  if (error) {
    console.error("[auth] resolveEmailByUsername RPC error:", error);
  }

  // 2. Jika email dari DB ditemukan & tidak kosong, gunakan email tersebut.
  // Jika kosong/null, otomatis gunakan format email sintetis internal yang cocok dengan createUser.
  const resolvedEmail =
    emailFromRpc && emailFromRpc.trim().length > 0
      ? emailFromRpc
      : `${cleanUsername}@sipkesmas.internal`;

  return { email: resolvedEmail };
}