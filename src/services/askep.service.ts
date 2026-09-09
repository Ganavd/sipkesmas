import { supabase } from "@/integrations/supabase/client";

export interface AskepUpdatePayload {
  tanggal: string;
  pengkajian: string;
  diagnosis: string;
  rencana_intervensi: string;
  implementasi: string;
  evaluasi_s: string;
  evaluasi_o: string;
  evaluasi_a: string;
  evaluasi_p: string;
}

export interface AskepRow {
  id: string;
  kunjungan_id: string;
  puskesmas_id: string | null;
  tanggal: string;
  pengkajian: string;
  diagnosis: string;
  rencana_intervensi: string;
  implementasi: string;
  evaluasi_s: string;
  evaluasi_o: string;
  evaluasi_a: string;
  evaluasi_p: string;
  petugas_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  
  // joined
  kunjungan_code?: string;
  tanggal_kunjungan?: string;
  jenis_kunjungan?: string;
  perihal?: string | null;
  keluarga_id?: string;
  keluarga_code?: string;
  kepala_keluarga?: string;
  nomor_kk?: string;
  nik?: string;
  alamat?: string | null;
  telepon?: string | null;
  puskesmas_nama?: string;
  puskesmas_kode?: string;
  puskesmas_alamat?: string | null;
  petugas_name?: string;
}

function mapAskepRow(row: any): AskepRow {
  return {
    ...row,
    kunjungan_code: row.kunjungan?.kunjungan_code,
    tanggal_kunjungan: row.kunjungan?.tanggal_kunjungan,
    jenis_kunjungan: row.kunjungan?.jenis_kunjungan,
    perihal: row.kunjungan?.perihal,
    keluarga_id: row.kunjungan?.keluarga?.id,
    keluarga_code: row.kunjungan?.keluarga?.keluarga_code,
    kepala_keluarga: row.kunjungan?.keluarga?.kepala_keluarga,
    nomor_kk: row.kunjungan?.keluarga?.nomor_kk,
    nik: row.kunjungan?.keluarga?.nik,
    alamat: row.kunjungan?.keluarga?.alamat,
    telepon: row.kunjungan?.keluarga?.telepon,
    puskesmas_nama: row.puskesmas?.nama_puskesmas ?? row.kunjungan?.puskesmas?.nama_puskesmas,
    puskesmas_kode: row.puskesmas?.kode ?? row.kunjungan?.puskesmas?.kode,
    puskesmas_alamat: row.puskesmas?.alamat ?? row.kunjungan?.puskesmas?.alamat,
    petugas_name: row.profiles?.full_name || row.profiles?.username,
  };
}

export interface AskepListOptions {
  includeDeleted?: boolean;
  deletedOnly?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export const askepService = {
  async list(opts?: AskepListOptions): Promise<AskepRow[]> {
    let query = supabase
      .from("asuhan_keperawatan")
      .select(`
        *,
        kunjungan:kunjungan_id(
          id,
          kunjungan_code,
          tanggal_kunjungan,
          jenis_kunjungan,
          perihal,
          keluarga:keluarga_id(id, keluarga_code, kepala_keluarga, nomor_kk, nik, alamat, telepon),
          puskesmas:puskesmas_id(nama_puskesmas, kode, alamat)
        ),
        puskesmas:puskesmas_id(nama_puskesmas, kode, alamat),
        profiles:petugas_id(full_name, username)
      `)
      .order("tanggal", { ascending: false });

    if (opts?.deletedOnly) query = query.not("deleted_at", "is", null);
    else if (!opts?.includeDeleted) query = query.is("deleted_at", null);

    if (opts?.startDate) {
      query = query.gte("tanggal", opts.startDate.toISOString());
    }
    if (opts?.endDate) {
      const endOfDay = new Date(opts.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("tanggal", endOfDay.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(mapAskepRow);
  },

  async getById(id: string): Promise<AskepRow | null> {
    const { data, error } = await supabase
      .from("asuhan_keperawatan")
      .select(`
        *,
        kunjungan:kunjungan_id(
          id,
          kunjungan_code,
          tanggal_kunjungan,
          jenis_kunjungan,
          perihal,
          keluarga:keluarga_id(id, keluarga_code, kepala_keluarga, nomor_kk, nik, alamat, telepon),
          puskesmas:puskesmas_id(nama_puskesmas, kode, alamat)
        ),
        puskesmas:puskesmas_id(nama_puskesmas, kode, alamat),
        profiles:petugas_id(full_name, username)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapAskepRow(data);
  },

  async update(id: string, payload: AskepUpdatePayload): Promise<void> {
    const { error } = await (supabase.from("asuhan_keperawatan") as any)
      .update(payload)
      .eq("id", id);

    if (error) throw error;
  },
};
