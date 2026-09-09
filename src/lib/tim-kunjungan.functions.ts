"use server";

import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit } from "@/lib/audit.server";

const createTimKunjunganSchema = z.object({
  user_id: z.string().uuid(),
  status_aktif: z.boolean().default(true),
});

const updateTimKunjunganSchema = z.object({
  id: z.string().uuid(),
  status_aktif: z.boolean(),
});

export async function createTimKunjunganAction(input: z.infer<typeof createTimKunjunganSchema>) {
  const { supabase, userId } = await requireSupabaseAuth();
  const payload = createTimKunjunganSchema.parse(input);

  // Verifikasi role dan dapatkan puskesmas_id admin saat ini
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("puskesmas_id")
    .eq("id", userId)
    .single();

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (profErr || roleData?.role !== "admin_puskesmas" || !profile?.puskesmas_id) {
    throw new Error("Hanya Admin Puskesmas yang dapat mengelola tim kunjungan");
  }

  const { data, error } = await supabaseAdmin
    .from("tim_kunjungan")
    .insert([{
      user_id: payload.user_id,
      status_aktif: payload.status_aktif,
      puskesmas_id: profile.puskesmas_id
    }])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await writeAudit({
    actorId: userId,
    action: "create_tim_kunjungan",
    entity: "tim_kunjungan",
    entityId: data.id,
    puskesmasId: profile.puskesmas_id,
    description: `Menambahkan anggota tim kunjungan.`,
    metadata: { target_user_id: payload.user_id },
  });

  return { success: true, data };
}

export async function updateTimKunjunganAction(input: z.infer<typeof updateTimKunjunganSchema>) {
  const { supabase, userId } = await requireSupabaseAuth();
  const payload = updateTimKunjunganSchema.parse(input);

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("puskesmas_id")
    .eq("id", userId)
    .single();

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (profErr || roleData?.role !== "admin_puskesmas" || !profile?.puskesmas_id) {
    throw new Error("Hanya Admin Puskesmas yang dapat mengubah status tim kunjungan");
  }

  const { data, error } = await supabaseAdmin
    .from("tim_kunjungan")
    .update({ 
      status_aktif: payload.status_aktif, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", payload.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await writeAudit({
    actorId: userId,
    action: "update_tim_kunjungan",
    entity: "tim_kunjungan",
    entityId: data.id,
    puskesmasId: data.puskesmas_id,
    description: `Mengubah status tim kunjungan.`,
    metadata: { status_aktif: payload.status_aktif },
  });

  return { success: true, data };
}

export async function getTimKunjunganAction() {
  const { userId } = await requireSupabaseAuth();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("puskesmas_id")
    .eq("id", userId)
    .single();

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  let query = supabaseAdmin
    .from("tim_kunjungan")
    .select("*, profiles:user_id(full_name, email)")
    .order("created_at", { ascending: false });

  if (roleData?.role !== "admin_dinkes") {
    if (!profile?.puskesmas_id) return [];
    query = query.eq("puskesmas_id", profile.puskesmas_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data;
}
