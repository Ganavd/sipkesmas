"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";
import { KunjunganDetailView } from "@/src/modules/kunjungan/views/kunjungan-detail-view";
import { KeluargaKunjunganDetailView } from "@/src/modules/kunjungan/views/keluarga-kunjungan-detail-view";

export default function KunjunganDetailPage() {
  const params = useParams();
  const kunjunganId = params.kunjunganId as string;
  const { role, isLoading } = useAuth();

  if (isLoading) return null;

  if (role === ROLES.KELUARGA) {
    return <KeluargaKunjunganDetailView id={kunjunganId} />;
  }

  return <KunjunganDetailView id={kunjunganId} />;
}
