/**
 * Notification queue server functions — list & mark-read for current user.
 */
"use server";

import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listNotificationsSchema = z.object({ limit: z.number().int().min(1).max(50).optional().default(20) });

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

export async function listNotifications(input?: Partial<ListNotificationsInput>) {
  const { supabase } = await requireSupabaseAuth();
  const data = listNotificationsSchema.parse(input ?? {});
    const { data: rows, error } = await supabase
      .from("notifications")
      .select("id,title,body,entity,entity_id,notification_type,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const unread = (rows ?? []).filter((r) => !r.is_read).length;
  return { items: rows ?? [], unread };
}

const markNotificationReadSchema = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional().default(false) });

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;

export async function markNotificationRead(input: MarkNotificationReadInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = markNotificationReadSchema.parse(input);
    const q = supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() });
    const { error } = data.all
      ? await q.eq("target_user_id", userId)
      : await q.eq("id", data.id ?? "");
    if (error) throw new Error(error.message);
  return { ok: true };
}