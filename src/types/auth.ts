import type { User, Session } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/constants/roles";

export interface AuthProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  username: string | null;
  email: string | null;
  puskesmas_id: string | null;
  is_active: boolean;
  avatar_url?: string | null;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  role: AppRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface SignInPayload {
  username: string;
  password: string;
}
