import { supabase } from "@/integrations/supabase/client";
import type { AuthProfile } from "@/types/auth";
import type { AppRole } from "@/lib/constants/roles";
import { isAppRole } from "@/lib/constants/roles";

export const profileService = {
  async getProfile(userId: string): Promise<AuthProfile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, username, email, puskesmas_id, is_active")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getRole(userId: string): Promise<AppRole | null> {
    const { data, error } = await supabase.rpc("get_user_role", {
      _user_id: userId,
    });

    if (error) throw error;
    return isAppRole(data) ? data : null;
  },
};
