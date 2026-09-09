"use server";

import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

async function requireDinkes() {
  const { supabase, userId } = await requireSupabaseAuth();
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin_dinkes")
    .maybeSingle();
  if (!role) throw new Error("Aksi ini hanya dapat dilakukan oleh Admin Dinkes");
  return { supabase, userId };
}

export async function softDeleteAskep(rawData: unknown) {
  const { supabase, userId } = await requireDinkes();
  const { ids } = idsSchema.parse(rawData);
  const { error } = await supabase
    .from("asuhan_keperawatan")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .in("id", ids);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function hardDeleteAskep(rawData: unknown) {
  const { supabase } = await requireDinkes();
  const { ids } = idsSchema.parse(rawData);
  const { error } = await supabase.from("asuhan_keperawatan").delete().in("id", ids);
  if (error) throw new Error(error.message);
  return { ok: true };
}