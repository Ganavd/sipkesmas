/**
 * Keluarga service — read via RLS. Mutations via server fn (keluarga.functions.ts).
 *
 * Filtering puskesmas:
 * - admin_dinkes → lihat semua
 * - lainnya → hanya puskesmas sendiri
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/constants/roles";
import { ROLES } from "@/lib/constants/roles";
import type { AnggotaKeluargaRow, KeluargaRow, KeluargaWithRelations } from "@/modules/keluarga/types";

export const keluargaService = {
  async list(opts?: { includeDeleted?: boolean; callerRole?: AppRole | null; callerPuskesmasId?: string | null }): Promise<KeluargaWithRelations[]> {
    let query = supabase
      .from("keluarga")
      .select(`
        *,
        puskesmas (nama_puskesmas),
        anggota_keluarga (id, deleted_at)
      `)
      .order("created_at", { ascending: false });

    if (!opts?.includeDeleted) {
      query = query.is("deleted_at", null);
    }

    // Filter per puskesmas untuk non-Dinkes
    if (opts?.callerRole !== ROLES.ADMIN_DINKES && opts?.callerPuskesmasId) {
      query = query.eq("puskesmas_id", opts.callerPuskesmasId);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];

    return rows.map((r: any) => ({
      ...r,
      puskesmas_nama: r.puskesmas?.nama_puskesmas ?? null,
      anggota_count: r.anggota_keluarga?.filter((a: any) => !a.deleted_at).length ?? 0,
    }));
  },

  async getById(id: string): Promise<KeluargaWithRelations | null> {
    const { data, error } = await supabase
      .from("keluarga")
      .select(`
        *,
        puskesmas (nama_puskesmas),
        anggota_keluarga (id, deleted_at)
      `)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const row = data[0] as any;
    return {
      ...row,
      puskesmas_nama: row.puskesmas?.nama_puskesmas ?? null,
      anggota_count: row.anggota_keluarga?.filter((a: any) => !a.deleted_at).length ?? 0,
    };
  },

  async listAnggota(keluargaId: string): Promise<AnggotaKeluargaRow[]> {
    const { data, error } = await supabase
      .from("anggota_keluarga")
      .select("*")
      .eq("keluarga_id", keluargaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};

export type { KeluargaRow, AnggotaKeluargaRow };
