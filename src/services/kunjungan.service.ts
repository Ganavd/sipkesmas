/**
 * Kunjungan service — read via RLS. Mutasi via server fn.
 *
 * Filter status/jenis/search sekarang dikerjakan di sisi client (lihat
 * kunjungan-list-view.tsx / keluarga-pengajuan-list-view.tsx) karena Status
 * (draft/terdaftar) diturunkan dari is_registered, bukan lagi kolom `status`
 * langsung — jadi filter di query database tidak relevan lagi di sini.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/constants/roles";
import { ROLES } from "@/lib/constants/roles";
import type { KunjunganWithRelations } from "@/modules/kunjungan/types";

export interface KunjunganListOptions {
  includeDeleted?: boolean;
  deletedOnly?: boolean;
  startDate?: Date;
  endDate?: Date;
  /** Role caller — dipakai untuk filter puskesmas */
  callerRole?: AppRole | null;
  /** puskesmas_id caller — filter jika bukan admin_dinkes */
  callerPuskesmasId?: string | null;
}

export const kunjunganService = {
  async list(opts?: KunjunganListOptions): Promise<KunjunganWithRelations[]> {
    let query = supabase
      .from("kunjungan")
      .select(`
        *,
        keluarga!inner (kepala_keluarga, keluarga_code, status, deleted_at),
        profiles!kunjungan_perawat_id_fkey (full_name, username),
        puskesmas (nama_puskesmas),
        kunjungan_tim (perawat_id, profiles:perawat_id(full_name, username))
      `)
      .order("tanggal_kunjungan", { ascending: false });

    query = query.eq("keluarga.status", "aktif").is("keluarga.deleted_at", null);

    if (opts?.deletedOnly) {
      query = query.not("deleted_at", "is", null);
    } else if (!opts?.includeDeleted) {
      query = query.is("deleted_at", null);
    }

    if (opts?.startDate) {
      query = query.gte("tanggal_kunjungan", opts.startDate.toISOString());
    }
    if (opts?.endDate) {
      const endOfDay = new Date(opts.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("tanggal_kunjungan", endOfDay.toISOString());
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
      keluarga_nama: r.keluarga?.kepala_keluarga ?? null,
      keluarga_code: r.keluarga?.keluarga_code ?? null,
      perawat_nama: r.profiles?.full_name || r.profiles?.username || null,
      puskesmas_nama: r.puskesmas?.nama_puskesmas ?? null,
      tl1_tim: (r.kunjungan_tim ?? []).map((team: any) => team.profiles?.full_name || team.profiles?.username).filter(Boolean),
    }));
  },

  async getById(id: string): Promise<KunjunganWithRelations | null> {
    const { data, error } = await supabase
      .from("kunjungan")
      .select(`
        *,
        keluarga (kepala_keluarga, keluarga_code),
        profiles!kunjungan_perawat_id_fkey (full_name, username),
        puskesmas (nama_puskesmas),
        kunjungan_tim (perawat_id, profiles:perawat_id(full_name, username))
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as any;
    return {
      ...row,
      keluarga_nama: row.keluarga?.kepala_keluarga ?? null,
      keluarga_code: row.keluarga?.keluarga_code ?? null,
      perawat_nama: row.profiles?.full_name || row.profiles?.username || null,
      puskesmas_nama: row.puskesmas?.nama_puskesmas ?? null,
      tl1_tim: (row.kunjungan_tim ?? []).map((team: any) => team.profiles?.full_name || team.profiles?.username).filter(Boolean),
    };
  },

  async listByKeluargaId(keluargaId: string): Promise<KunjunganWithRelations[]> {
    const { data, error } = await supabase
      .from("kunjungan")
      .select(`
        *,
        keluarga (kepala_keluarga, keluarga_code),
        profiles!kunjungan_perawat_id_fkey (full_name, username),
        puskesmas (nama_puskesmas)
      `)
      .eq("keluarga_id", keluargaId)
      .is("deleted_at", null)
      .order("tanggal_kunjungan", { ascending: false });

    if (error) throw error;
    const rows = data ?? [];

    return rows.map((r: any) => ({
      ...r,
      keluarga_nama: r.keluarga?.kepala_keluarga ?? null,
      keluarga_code: r.keluarga?.keluarga_code ?? null,
      perawat_nama: r.profiles?.full_name || r.profiles?.username || null,
      puskesmas_nama: r.puskesmas?.nama_puskesmas ?? null,
    }));
  },
};