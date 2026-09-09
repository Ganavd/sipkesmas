
import { createTimKunjunganAction, updateTimKunjunganAction, getTimKunjunganAction } from "@/lib/tim-kunjungan.functions";

export interface TimKunjunganRow {
  id: string;
  puskesmas_id: string;
  user_id: string;
  status_aktif: boolean;
  created_at: string;
  updated_at: string;
  // joined from profiles
  user_name?: string;
  user_email?: string;
}

export const timKunjunganService = {
  async list(): Promise<TimKunjunganRow[]> {
    const data = await getTimKunjunganAction();
    
    // mapping the joined profiles data
    return (data || []).map((row: any) => ({
      ...row,
      user_name: row.profiles?.full_name,
      user_email: row.profiles?.email,
    }));
  },

  async create(payload: { user_id: string; status_aktif: boolean }): Promise<TimKunjunganRow> {
    const res = await createTimKunjunganAction(payload);
    return res.data as any;
  },

  async update(id: string, payload: { status_aktif: boolean }): Promise<TimKunjunganRow> {
    const res = await updateTimKunjunganAction({ id, ...payload });
    return res.data as any;
  },
};
