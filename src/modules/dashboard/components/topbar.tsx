"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  User as UserIcon,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/common/role-badge";
import { NotificationBell } from "@/components/common/notification-bell";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";
import { toast } from "sonner";

interface TopbarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
}

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function getBreadcrumbsForPath(pathname: string, role: string | null): BreadcrumbSegment[] {
  const isKeluarga = role === ROLES.KELUARGA;

  if (pathname.startsWith("/dashboard")) {
    return [{ label: "Dashboard" }];
  }

  if (pathname.startsWith("/kunjungan")) {
    const isDaftar = pathname.includes("/daftar");
    const isLog = pathname.includes("/log");
    const isTambah = pathname.includes("/tambah");
    const isEdit = pathname.includes("/edit");

    if (isKeluarga) {
      if (isDaftar || pathname === "/kunjungan") {
        return [{ label: "Pendataan" }, { label: "Daftar Pengajuan Kunjungan" }];
      }
      return [
        { label: "Pendataan" },
        { label: "Daftar Pengajuan Kunjungan", href: "/kunjungan/daftar" },
        { label: "Detail Pengajuan Kunjungan" },
      ];
    }

    // Staf
    if (isTambah) {
      return [{ label: "Pendataan" }, { label: "Tambah Kunjungan" }];
    }
    if (isLog) {
      return [{ label: "Pendataan" }, { label: "Log Kunjungan" }];
    }
    if (isEdit) {
      return [
        { label: "Pendataan" },
        { label: "Daftar Kunjungan", href: "/kunjungan/daftar" },
        { label: "Edit Kunjungan" },
      ];
    }
    if (isDaftar) {
      return [{ label: "Pendataan" }, { label: "Daftar Kunjungan" }];
    }
    // Detail kunjungan
    return [
      { label: "Pendataan" },
      { label: "Daftar Kunjungan", href: "/kunjungan/daftar" },
      { label: "Detail Kunjungan" },
    ];
  }

  if (pathname.startsWith("/keluarga")) {
    const isTambah = pathname.includes("/tambah");
    const isEdit = pathname.includes("/edit");
    const isDaftar = pathname.includes("/daftar");

    if (isTambah) {
      return [
        { label: "Manajemen" },
        { label: "Daftar Keluarga", href: "/keluarga/daftar" },
        { label: "Tambah Keluarga" },
      ];
    }
    if (isEdit) {
      return [
        { label: "Manajemen" },
        { label: "Daftar Keluarga", href: "/keluarga/daftar" },
        { label: "Edit Keluarga" },
      ];
    }
    if (isDaftar) {
      return [{ label: "Manajemen" }, { label: "Manajemen Keluarga" }];
    }
    return [
      { label: "Manajemen" },
      { label: "Daftar Keluarga", href: "/keluarga/daftar" },
      { label: "Detail Keluarga" },
    ];
  }

  if (pathname.startsWith("/puskesmas")) {
    return [{ label: "Manajemen" }, { label: "Manajemen Puskesmas" }];
  }

  if (pathname.startsWith("/users")) {
    return [{ label: "Manajemen" }, { label: "Manajemen User" }];
  }

  if (pathname.startsWith("/rekam-medis")) {
    return [{ label: "Pendataan" }, { label: "Daftar Asuhan Keperawatan" }];
  }

  if (pathname.startsWith("/pengaturan")) {
    return [{ label: "Pengaturan" }];
  }

  return [];
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const base = (name || email || "U").trim();
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function Topbar({ collapsed, onToggleCollapsed, onOpenMobile }: TopbarProps) {
  const { user, profile, role, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";

  const breadcrumbs = getBreadcrumbsForPath(pathname, role);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Berhasil keluar");
      router.push("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal keluar";
      toast.error(message);
    }
  };

  const displayName = profile?.full_name || user?.email || "Pengguna";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobile}
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
      >
        {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>

      {/* Dynamic Breadcrumbs in Topbar (Blue Zone) */}
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="ml-2 hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-medium"
        >
          {breadcrumbs.map((segment, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={index} className="flex items-center gap-1.5">
                {segment.href && !isLast ? (
                  <Link href={segment.href} className="hover:text-foreground transition-colors">
                    {segment.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-foreground font-semibold" : ""}>
                    {segment.label}
                  </span>
                )}
                {!isLast && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                )}
              </span>
            );
          })}
        </nav>
      )}

      <div className="ml-auto flex items-center gap-3">
        {role && <RoleBadge role={role} className="hidden sm:inline-flex" />}
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-2">
              <Avatar className="h-7 w-7">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="Foto profil" />}
                <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
                  {getInitials(profile?.full_name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground sm:inline">
                {displayName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/pengaturan")}>
              <UserIcon className="mr-2 h-4 w-4" />
              Pengaturan Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
