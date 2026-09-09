/**
 * Puskesmas service — uses browser Supabase client (RLS enforces admin_dinkes writes).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Puskesmas = Database["public"]["Tables"]["puskesmas"]["Row"];
export type PuskesmasInsert = Database["public"]["Tables"]["puskesmas"]["Insert"];
export type PuskesmasUpdate = Database["public"]["Tables"]["puskesmas"]["Update"];

export const puskesmasService = {
  async list(): Promise<Puskesmas[]> {
    const { data, error } = await supabase
      .from("puskesmas")
      .select("*")
      .order("nama_puskesmas");
    if (error) throw error;
    return data ?? [];
  },

  async count(): Promise<number> {
    const { count, error } = await supabase
      .from("puskesmas")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  },

  async get(id: string): Promise<Puskesmas | null> {
    const { data, error } = await supabase
      .from("puskesmas")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: PuskesmasInsert): Promise<Puskesmas> {
    const { data, error } = await supabase
      .from("puskesmas")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: PuskesmasUpdate): Promise<Puskesmas> {
    const { data, error } = await supabase
      .from("puskesmas")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleStatus(id: string, status: "aktif" | "nonaktif"): Promise<void> {
    const { error } = await supabase.from("puskesmas").update({ status }).eq("id", id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { data: puskesmas, error: puskesmasError } = await supabase
      .from("puskesmas")
      .select("nama_puskesmas")
      .eq("id", id)
      .single();
    if (puskesmasError) throw puskesmasError;

    const { count, error: profilesError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("puskesmas_id", id);
    if (profilesError) throw profilesError;

    if ((count ?? 0) > 0) {
      throw new Error(
        `Tidak bisa hapus puskesmas ${puskesmas.nama_puskesmas} dengan kondisi ada user yang masih terhubung di puskesmas ${puskesmas.nama_puskesmas}.`,
      );
    }

    const { error: deleteError } = await supabase.from("puskesmas").delete().eq("id", id);
    if (deleteError) throw deleteError;
  },
};
