/**
 * Audit log service — read via RLS (admin_dinkes semua, admin_puskesmas scope, lainnya milik sendiri).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

export interface AuditListOptions {
  limit?: number;
  entity?: string;
  startDate?: Date;
  endDate?: Date;
}

export const auditService = {
  async list(opts: AuditListOptions = {}): Promise<AuditLogRow[]> {
    let q = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (opts.limit) {
      q = q.limit(opts.limit);
    }
    
    if (opts.entity) {
      q = q.eq("entity", opts.entity);
    }

    if (opts.startDate) {
      q = q.gte("created_at", opts.startDate.toISOString());
    }
    if (opts.endDate) {
      const endOfDay = new Date(opts.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      q = q.lte("created_at", endOfDay.toISOString());
    }

    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
};