/**
 * Centralized role registry.
 * Single source of truth for all role-based logic in SIPKESMAS.
 * Never hardcode role strings elsewhere — always import from here.
 */
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLES = {
  ADMIN_DINKES: "admin_dinkes",
  ADMIN_PUSKESMAS: "admin_puskesmas",
  PERAWAT: "perawat",
  KELUARGA: "keluarga",
} as const satisfies Record<string, AppRole>;

export const ROLE_LABELS: Record<AppRole, string> = {
  admin_dinkes: "Admin Dinkes",
  admin_puskesmas: "Admin Puskesmas",
  perawat: "Perawat",
  keluarga: "Keluarga",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin_dinkes: "Pengelola sistem tingkat Dinas Kesehatan",
  admin_puskesmas: "Pengelola operasional Puskesmas",
  perawat: "Tenaga perawat lapangan",
  keluarga: "Anggota keluarga binaan",
};

export const ALL_ROLES: readonly AppRole[] = [
  ROLES.ADMIN_DINKES,
  ROLES.ADMIN_PUSKESMAS,
  ROLES.PERAWAT,
  ROLES.KELUARGA,
];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}
