/**
 * Server-only audit helper. Tulis ke audit_logs langsung via service role.
 * Jangan diimpor dari kode client.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AuditEntry {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  puskesmasId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EnrichedAuditItem {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  description: string | null;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
}

/**
 * Enrich audit rows dengan nama actor + role. Memakai supabaseAdmin agar
 * lookup tetap bekerja meski RLS profiles membatasi cross-puskesmas read.
 */
export async function enrichAuditItems(
  rows: Array<{
    id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    description: string | null;
    created_at: string;
    actor_id: string | null;
    actor_role?: string | null;
    metadata?: unknown;
  }>,
): Promise<EnrichedAuditItem[]> {
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_id).filter((v): v is string => Boolean(v))),
  );
  let nameMap = new Map<string, string>();
  let roleMap = new Map<string, string>();
  if (actorIds.length) {
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, username").in("id", actorIds),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", actorIds),
    ]);
    nameMap = new Map((profs ?? []).map((p) => [p.id, (p.full_name?.trim() || p.username || "Pengguna")]));
    roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as string]));
  }
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entity_id: r.entity_id,
    description: r.description,
    created_at: r.created_at,
    actor_id: r.actor_id,
    actor_name: r.actor_id ? (nameMap.get(r.actor_id) ?? null) : null,
    actor_role: r.actor_id
      ? (roleMap.get(r.actor_id) ?? (r.actor_role ?? null))
      : (r.actor_role ?? null),
  }));
}

/**
 * Update last_activity_at pengguna (best-effort).
 */
export async function touchUserActivity(userId: string): Promise<void> {
  try {
    await supabaseAdmin.rpc("touch_user_activity", { _user_id: userId });
  } catch (e) {
    console.error("[audit] touch activity failed", e);
  }
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  // Lookup actor role (best-effort, tidak boleh memblokir aksi utama).
  let actorRole: string | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", entry.actorId)
      .maybeSingle();
    actorRole = data?.role ?? null;
  } catch {
    actorRole = null;
  }

  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_id: entry.actorId,
    actor_role: actorRole as never,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    puskesmas_id: entry.puskesmasId ?? null,
    description: entry.description ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
  if (error) console.error("[audit] insert failed", error);
  // Selalu touch activity setelah aksi termonitor.
  await touchUserActivity(entry.actorId);
}
