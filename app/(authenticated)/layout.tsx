"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/hooks/use-auth";
import { Loading } from "@/components/common/loading";
import { DashboardLayout } from "@/src/modules/dashboard/components/dashboard-layout";

import { AutoLogout } from "@/src/components/auth/auto-logout";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Do not block rendering while auth is loading — allow entering the UI
  // immediately and perform redirect once loading completes.
  if (!isAuthenticated && !isLoading) {
    // If loading finished and user is not authenticated, show full-screen
    // loading state while the redirect in useEffect runs.
    return <Loading fullscreen label="Mengarahkan..." />;
  }

  return (
    <>
      <AutoLogout />
      <DashboardLayout>{children}</DashboardLayout>
    </>
  );
}
