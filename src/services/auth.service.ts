/**
 * Auth service — wraps Supabase auth + username-resolution server fn.
 * Modules depend on this service, not on supabase client directly.
 */
import { supabase } from "@/integrations/supabase/client";
import { resolveEmailByUsername } from "@/actions/auth";
import type { SignInPayload } from "@/types/auth";

export const authService = {
  async signIn({ username, password }: SignInPayload) {
    const { email } = await resolveEmailByUsername({ username });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Generic message — don't reveal whether username or password is the issue.
      throw new Error("Username atau kata sandi salah");
    }
    if (data.user) {
      // Best-effort activity tracking. Tidak boleh memblokir login.
      void supabase.rpc("touch_last_login", { _user_id: data.user.id });
    }
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
};
