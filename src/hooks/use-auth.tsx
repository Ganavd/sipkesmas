"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { profileService } from "@/services/profile.service";
import { authService } from "@/services/auth.service";
import type { AuthProfile, AuthState, SignInPayload } from "@/types/auth";
import type { AppRole } from "@/lib/constants/roles";

interface AuthContextValue extends AuthState {
  signIn: (payload: SignInPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_CONTEXT_CACHE_KEY = "sipkesmas.auth.context";
const SESSION_START_KEY = "sipkesmas.auth.session_start";
const AUTH_BOOTSTRAP_TIMEOUT_MS = 2500;

/** Batas maksimal sesi: 24 jam. Setelah itu user wajib login ulang. */
const SESSION_MAX_MS = 24 * 60 * 60 * 1000;

interface CachedAuthContext {
  userId: string;
  profile: AuthProfile | null;
  role: AppRole | null;
}

function formatAuthContextError(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err) {
    const errorLike = err as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    return {
      message: typeof errorLike.message === "string" ? errorLike.message : undefined,
      code: errorLike.code,
      details: errorLike.details,
      hint: errorLike.hint,
    };
  }
  return err;
}

function readCachedAuthContext(userId: string): CachedAuthContext | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_CONTEXT_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedAuthContext>;
    if (parsed.userId !== userId) return null;

    return {
      userId,
      profile: parsed.profile ?? null,
      role: parsed.role ?? null,
    };
  } catch {
    return null;
  }
}

function writeCachedAuthContext(context: CachedAuthContext) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(AUTH_CONTEXT_CACHE_KEY, JSON.stringify(context));
  } catch {
    // Cache is only a perceived-performance helper.
  }
}

function clearCachedAuthContext() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(AUTH_CONTEXT_CACHE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/** Catat waktu login (timestamp ms). Dipanggil saat SIGNED_IN. */
function markSessionStart() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_START_KEY, String(Date.now()));
  } catch {
    // Abaikan error storage.
  }
}

/** Hapus catatan waktu login. Dipanggil saat sign out. */
function clearSessionStart() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_START_KEY);
  } catch {
    // Abaikan error storage.
  }
}

/**
 * Cek apakah sesi sudah melewati batas 24 jam.
 * Jika tidak ada catatan waktu login, anggap sesi baru (belum expired).
 */
function isSessionExpired(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(SESSION_START_KEY);
    if (!raw) return false;
    const start = parseInt(raw, 10);
    if (isNaN(start)) return false;
    return Date.now() - start > SESSION_MAX_MS;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserContext = async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setRole(null);
      clearCachedAuthContext();
      return;
    }

    const cached = readCachedAuthContext(currentUser.id);
    if (cached) {
      setProfile(cached.profile);
      setRole(cached.role);
    }

    const [profileResult, roleResult] = await Promise.allSettled([
      cached?.profile ? Promise.resolve(cached.profile) : profileService.getProfile(currentUser.id),
      cached?.role ? Promise.resolve(cached.role) : profileService.getRole(currentUser.id),
    ]);

    if (profileResult.status === "fulfilled") {
      const nextProfile: AuthProfile = {
        ...(profileResult.value as AuthProfile),
        avatar_url: currentUser.user_metadata?.avatar_url ?? null,
      } as AuthProfile;
      setProfile(nextProfile);
    } else {
      console.warn("[auth] failed to load profile", formatAuthContextError(profileResult.reason));
      setProfile(cached?.profile ?? null);
    }

    if (roleResult.status === "fulfilled") {
      setRole(roleResult.value as AppRole | null);
    } else {
      console.warn("[auth] failed to load role", formatAuthContextError(roleResult.reason));
      setRole(cached?.role ?? null);
    }

    writeCachedAuthContext({
      userId: currentUser.id,
      profile:
        profileResult.status === "fulfilled"
          ? ({
              ...(profileResult.value as AuthProfile),
              avatar_url: currentUser.user_metadata?.avatar_url ?? null,
            } as AuthProfile)
          : (cached?.profile ?? null),
      role:
        roleResult.status === "fulfilled"
          ? (roleResult.value as AppRole | null)
          : (cached?.role ?? null),
    });
  };

  useEffect(() => {
    // onAuthStateChange menangani perubahan sesi (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN") {
        // Catat waktu login hanya saat benar-benar login baru
        markSessionStart();
      }
      if (event === "SIGNED_OUT" || !nextSession) {
        // Sesi hilang (logout atau kedaluwarsa) — hapus cache & timestamp
        clearCachedAuthContext();
        clearSessionStart();
        setProfile(null);
        setRole(null);
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void loadUserContext(nextSession?.user ?? null);
    });

    const bootstrap = async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Auth bootstrap timeout")), AUTH_BOOTSTRAP_TIMEOUT_MS);
        });

        const userResponse = await Promise.race([supabase.auth.getUser(), timeoutPromise]);

        const { data: userData, error: userError } = userResponse;
        if (userError || !userData.user) {
          clearCachedAuthContext();
          clearSessionStart();
          setSession(null);
          setUser(null);
          setProfile(null);
          setRole(null);
          setIsLoading(false);
          return;
        }

        if (isSessionExpired()) {
          console.info("[auth] sesi melebihi 24 jam, paksa logout.");
          clearCachedAuthContext();
          clearSessionStart();
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setRole(null);
          setIsLoading(false);
          return;
        }

        const sessionResponse = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error("Auth session bootstrap timeout")),
              AUTH_BOOTSTRAP_TIMEOUT_MS,
            );
          }),
        ]);

        const { data: sessionData, error: sessionError } = sessionResponse;
        if (sessionError) {
          setSession(null);
          setUser(userData.user);
          setIsLoading(false);
          void loadUserContext(userData.user);
          return;
        }

        setSession(sessionData.session);
        setUser(userData.user);
        setIsLoading(false);
        void loadUserContext(userData.user);
      } catch (err) {
        console.warn("[auth] failed to verify user", formatAuthContextError(err));
        clearCachedAuthContext();
        clearSessionStart();
        setSession(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        setIsLoading(false);
      }
    };

    void bootstrap();

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      role,
      isLoading,
      isAuthenticated: !!user,
      signIn: async (payload) => {
        await authService.signIn(payload);
      },
      signOut: async () => {
        clearSessionStart();
        clearCachedAuthContext();
        await authService.signOut();
      },
      refresh: async () => {
        await loadUserContext(user);
      },
    }),
    [user, session, profile, role, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
