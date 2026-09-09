"use client";

import { useAuth } from "@/src/hooks/use-auth";
import { Loading } from "@/components/common/loading";
import { EmptyState } from "@/components/common/empty-state";
import { RoleDashboard } from "@/src/modules/dashboard/views/role-dashboard";
import { ShieldAlert } from "lucide-react";

export default function DashboardPage() {
  const { role, isLoading } = useAuth();

  if (isLoading) return <Loading label="Memuat dashboard..." />;

  if (!role) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Peran belum diatur"
        description="Akun Anda belum memiliki peran. Hubungi Admin Dinkes untuk mengatur peran Anda."
      />
    );
  }

  return <RoleDashboard role={role} />;
}
