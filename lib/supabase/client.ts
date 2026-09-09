import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/integrations/supabase/types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase URL or Publishable/Anon Key");
  }

  return createBrowserClient<Database>(url, anonKey, {
    cookieOptions: {
      maxAge: undefined as unknown as number,
    },
  });
}

// Single instance for browser-only use if needed
export const supabase = typeof window !== "undefined" ? createClient() : null!;
