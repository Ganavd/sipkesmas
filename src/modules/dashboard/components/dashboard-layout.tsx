import { useState, type ReactNode, Suspense } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { useAuth } from "@/hooks/use-auth";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { role } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Suspense fallback={<div className="w-56 bg-surface/50" />}>
        <Sidebar
          role={role}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-12 w-full bg-surface/50" />}>
          <Topbar
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((c) => !c)}
            onOpenMobile={() => setMobileOpen(true)}
          />
        </Suspense>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <ErrorBoundary>
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
