/**
 * Users service — read-side via RLS. Mutations go through server fns.
 *
 * Filtering puskesmas:
 * - admin_dinkes  → lihat semua user (tidak difilter)
 * - admin_puskesmas / perawat → hanya user dari puskesmas mereka sendiri
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/constants/roles";
import { ROLES } from "@/lib/constants/roles";

export interface UserRow {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  email_konfirmasi: string | null;
  phone: string | null;
  puskesmas_id: string | null;
  is_active: boolean;
  created_at: string;
  role: AppRole | null;
  puskesmas_nama: string | null;
}

export interface UsersListOptions {
  /** Role user yang sedang login */
  callerRole?: AppRole | null;
  /** puskesmas_id user yang sedang login (wajib untuk non-Dinkes) */
  callerPuskesmasId?: string | null;
}

export const usersService = {
  async list(opts?: UsersListOptions): Promise<UserRow[]> {
    let q = supabase
      .from("profiles")
      .select("id, full_name, username, email, email_konfirmasi, phone, puskesmas_id, is_active, created_at")
      .order("created_at", { ascending: false });

    // Admin Dinkes lihat semua; selain itu filter per puskesmas
    if (opts?.callerRole !== ROLES.ADMIN_DINKES && opts?.callerPuskesmasId) {
      q = q.eq("puskesmas_id", opts.callerPuskesmasId);
    }

    const { data: profiles, error } = await q;
    if (error) throw error;
    const rows = profiles ?? [];
    if (rows.length === 0) return [];

    const userIds = rows.map((r) => r.id);
    const puskesmasIds = Array.from(
      new Set(rows.map((r) => r.puskesmas_id).filter((v): v is string => !!v)),
    );

    const [{ data: roles }, { data: pusk }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      puskesmasIds.length > 0
        ? supabase.from("puskesmas").select("id, nama_puskesmas").in("id", puskesmasIds)
        : Promise.resolve({ data: [] as { id: string; nama_puskesmas: string }[] }),
    ]);

    const roleMap = new Map<string, AppRole>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as AppRole));
    const puskMap = new Map<string, string>();
    (pusk ?? []).forEach((p) => puskMap.set(p.id, p.nama_puskesmas));

    return rows.map((p) => ({
      id: p.id,
      full_name: p.full_name,
      username: p.username,
      email: p.email,
      email_konfirmasi: (p as { email_konfirmasi: string | null }).email_konfirmasi ?? null,
      phone: p.phone,
      puskesmas_id: p.puskesmas_id,
      is_active: p.is_active,
      created_at: p.created_at,
      role: roleMap.get(p.id) ?? null,
      puskesmas_nama: p.puskesmas_id ? puskMap.get(p.puskesmas_id) ?? null : null,
    }));
  },
};
