/**
 * Role-based sidebar navigation registry. Single source of truth.
 *
 * Struktur ini mengikuti sipkesmas-rencana-revisi.md bagian 1/1.1/1.2:
 * - Dashboard selalu berdiri sendiri di paling atas (section label kosong).
 * - "Manajemen" (Puskesmas/User/Keluarga) tiap menu cuma 1 item -> halaman
 *   Daftar, tombol Tambah ada di dalam halaman itu sendiri (bukan nav terpisah).
 * - "Pendataan" tetap 5 item terpisah untuk staff (Dinkes/Admin Puskesmas/
 *   Perawat), dan 2 item berbeda untuk Keluarga (dalam section yang sama,
 *   supaya tidak ada duplikat label section).
 * - "Obat" & grup "Puskesmas" (khusus Keluarga) masih placeholder ("Segera
 *   Hadir") sesuai kesepakatan — isi form/halamannya menyusul fase berikutnya.
 */
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Building2,
  ClipboardList,
  HeartPulse,
  FileText,
  Pill,
  Stethoscope,
  ListChecks,
  BookCheck,
} from "lucide-react";
import { ROLES, type AppRole } from "@/lib/constants/roles";

export interface NavItem {
  label: string;
  to?: string;
  icon: LucideIcon;
  roles: readonly AppRole[];
  disabled?: boolean;
  comingSoon?: boolean;
  children?: NavItem[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

// Admin Dinkes + Admin Puskesmas + Perawat — "staff" operasional
const OPERATIONAL: readonly AppRole[] = [
  ROLES.ADMIN_DINKES,
  ROLES.ADMIN_PUSKESMAS,
  ROLES.PERAWAT,
];

// Cuma Admin Dinkes yang boleh mengelola data Puskesmas
const DINKES_ONLY: readonly AppRole[] = [ROLES.ADMIN_DINKES];

// Admin Dinkes + Admin Puskesmas — pengelola user (Admin Puskesmas terkunci ke puskesmasnya sendiri di level form)
const DINKES_DAN_PUSKESMAS: readonly AppRole[] = [
  ROLES.ADMIN_DINKES,
  ROLES.ADMIN_PUSKESMAS,
];

const SEMUA_ROLE: readonly AppRole[] = [
  ROLES.ADMIN_DINKES,
  ROLES.ADMIN_PUSKESMAS,
  ROLES.PERAWAT,
  ROLES.KELUARGA,
];

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    // label kosong -> Dashboard tampil berdiri sendiri, bukan bagian dari grup manapun
    label: "",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, roles: SEMUA_ROLE },
    ],
  },
  {
    label: "Manajemen",
    items: [
      { label: "Manajemen Puskesmas", to: "/puskesmas", icon: Building2, roles: DINKES_ONLY },
      { label: "Manajemen User", to: "/users", icon: Users, roles: DINKES_DAN_PUSKESMAS },
      { label: "Manajemen Keluarga", to: "/keluarga/daftar", icon: HeartPulse, roles: OPERATIONAL },
      { label: "Tim Kunjungan", to: "/tim-kunjungan", icon: Users, roles: [ROLES.ADMIN_PUSKESMAS, ROLES.ADMIN_DINKES] },
    ],
  },
  {
    label: "Pendataan",
    items: [
      // --- staff (Dinkes/Admin Puskesmas/Perawat) ---
      { label: "Tambah Kunjungan", to: "/kunjungan/tambah", icon: ClipboardList, roles: [ROLES.PERAWAT] },
      { label: "Daftar Kunjungan", to: "/kunjungan/daftar", icon: BookCheck, roles: OPERATIONAL },
      { label: "Daftar Asuhan Keperawatan", to: "/askep", icon: Stethoscope, roles: OPERATIONAL },
      { label: "Log Kunjungan", to: "/kunjungan/log", icon: ListChecks, roles: OPERATIONAL },
      // --- Keluarga (item & urutan beda, tapi tetap 1 section "Pendataan") ---
      { label: "Daftar Pengajuan Kunjungan", to: "/kunjungan/daftar", icon: ClipboardList, roles: [ROLES.KELUARGA] },
      {
        label: "Daftar Asuhan Keperawatan",
        to: "/rekam-medis",
        icon: Stethoscope,
        roles: [ROLES.KELUARGA],
        // TODO fase 3: halaman /rekam-medis perlu deteksi role Keluarga dan
        // sembunyikan semua aksi selain "Lihat" (read-only) — belum bisa
        // diatur dari navigation.ts, harus di level komponen halamannya.
      },
    ],
  },
  {
    label: "Obat",
    items: [
      { label: "Tambah Obat", icon: Pill, roles: OPERATIONAL, disabled: true, comingSoon: true },
      { label: "Daftar Obat", icon: BookCheck, roles: OPERATIONAL, disabled: true, comingSoon: true },
    ],
  },
  {
    // Khusus Keluarga: info seputar puskesmas yang menaungi mereka
    label: "Puskesmas",
    items: [
      { label: "Profil Puskesmas", icon: Building2, roles: [ROLES.KELUARGA], disabled: true, comingSoon: true },
      { label: "Program Perkesmas", icon: FileText, roles: [ROLES.KELUARGA], disabled: true, comingSoon: true },
      { label: "Anggota", icon: Users, roles: [ROLES.KELUARGA], disabled: true, comingSoon: true },
    ],
  },
];

function filterItems(items: NavItem[], role: AppRole): NavItem[] {
  return items
    .filter((it) => it.roles.includes(role))
    .map((it) => (it.children ? { ...it, children: filterItems(it.children, role) } : it))
    .filter((it) => !it.children || it.children.length > 0);
}

export function getNavSectionsForRole(role: AppRole | null): NavSection[] {
  if (!role) return [];
  return NAV_SECTIONS
    .map((section) => ({ ...section, items: filterItems([...section.items], role) }))
    .filter((section) => section.items.length > 0);
}
