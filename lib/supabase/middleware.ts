import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update the response cookies so the session is refreshed
        // Sertakan maxAge & expires agar cookie tidak menjadi session-only
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isRoot = request.nextUrl.pathname === "/";

  if (isRoot) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Keep middleware as a lightweight authentication redirect gate only.
  // Role-based URL restrictions are intentionally left to the app/UI layer
  // to avoid extra RPC work on every route request and to avoid introducing
  // a second source of truth that can become a latency hotspot.
  return supabaseResponse;
}
