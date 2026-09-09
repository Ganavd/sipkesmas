"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

export async function listNotifications(rawData?: { limit?: number }) {
  const { supabase } = await checkAuth();
  const input = z.object({
    limit: z.number().int().min(1).max(50).optional().default(20)
  }).parse(unpack(rawData ?? {}));

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id,title,body,entity,entity_id,notification_type,is_read,created_at")
    .order("created_at", { ascending: false })
    .limit(input.limit);

  if (error) throw new Error(error.message);
  const unread = (rows ?? []).filter((r) => !r.is_read).length;
  return { items: rows ?? [], unread };
}

export async function markNotificationRead(rawData: { id?: string; all?: boolean }) {
  const { supabase, userId } = await checkAuth();
  const input = z.object({
    id: z.string().uuid().optional(),
    all: z.boolean().optional().default(false)
  }).parse(unpack(rawData));

  const q = supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() });
  const { error } = input.all
    ? await q.eq("target_user_id", userId)
    : await q.eq("id", input.id ?? "");

  if (error) throw new Error(error.message);
  return { ok: true };
}
