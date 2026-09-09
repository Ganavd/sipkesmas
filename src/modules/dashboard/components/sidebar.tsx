import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getNavSectionsForRole, type NavItem } from "@/modules/dashboard/config/navigation";
import type { AppRole } from "@/lib/constants/roles";

interface SidebarProps {
  role: AppRole | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ role, collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const sections = role ? getNavSectionsForRole(role) : [];
  const pathname = usePathname() ?? "";

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          aria-label="Tutup menu"
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-[transform,width] duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
              <Image
                src="/icon.png"
                alt="Logo SIPKESMAS"
                width={36}
                height={36}
                className="h-9 w-9 object-cover"
              />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">SIPKESMAS</p>
                <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  Sistem Informasi
                </p>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMobileClose}
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 px-3 py-4">
          {role ? (
            <nav className="space-y-6">
              {sections.map((section) => (
                <div key={section.label}>
                  {!collapsed && section.label && (
                    <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.label}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      return (
                        <SidebarItem
                          key={`${section.label}-${item.label}`}
                          item={item}
                          pathname={pathname}
                          collapsed={collapsed}
                          onNavigate={onMobileClose}
                        />
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          ) : (
            <SidebarMenuSkeleton collapsed={collapsed} />
          )}
        </ScrollArea>

        {!collapsed && (
          <div className="border-t border-sidebar-border px-4 py-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              © {new Date().getFullYear()} Dinas Kesehatan
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

function SidebarMenuSkeleton({ collapsed }: { collapsed: boolean }) {
  const groups = [3, 2, 4];

  return (
    <div className="space-y-6" aria-label="Memuat menu">
      {groups.map((count, groupIndex) => (
        <div key={groupIndex}>
          {!collapsed && <div className="mb-3 h-3 w-24 rounded bg-muted" />}
          <ul className="space-y-2">
            {Array.from({ length: count }).map((_, itemIndex) => (
              <li key={itemIndex}>
                <div
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-md px-2.5",
                    collapsed && "justify-center",
                  )}
                >
                  <div className="h-4 w-4 shrink-0 rounded bg-muted" />
                  {!collapsed && <div className="h-3 flex-1 rounded bg-muted" />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SidebarItem({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const hasChildren = !!item.children && item.children.length > 0;
  const childActive = hasChildren && item.children!.some((c) => c.to === pathname);
  const [open, setOpen] = useState<boolean>(childActive);
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (hasChildren) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            childActive
              ? "bg-sidebar-accent/60 text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60",
            collapsed && "justify-center",
          )}
          title={collapsed ? item.label : undefined}
        >
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-sidebar-foreground" />
          {!collapsed && (
            <>
              <span className="truncate">{item.label}</span>
              <ChevronRight
                className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-90")}
              />
            </>
          )}
        </button>
        {!collapsed && open && (
          <ul className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-2">
            {item.children!.map((child) => (
              <SidebarItem
                key={`${item.label}-${child.label}`}
                item={child}
                pathname={pathname}
                collapsed={false}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const active = item.to ? pathname === item.to : false;
  if (item.disabled || !item.to) {
    return (
      <li>
        <div
          className={cn(
            "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium opacity-60",
            "cursor-not-allowed text-muted-foreground",
            collapsed && "justify-center",
          )}
          title={collapsed ? `${item.label} — segera hadir` : undefined}
        >
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          {!collapsed && (
            <>
              <span className="truncate">{item.label}</span>
              {item.comingSoon && (
                <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                  Segera
                </span>
              )}
            </>
          )}
        </div>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={item.to}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60",
          collapsed && "justify-center",
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active
              ? "text-sidebar-primary"
              : "text-muted-foreground group-hover:text-sidebar-foreground",
          )}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </li>
  );
}
