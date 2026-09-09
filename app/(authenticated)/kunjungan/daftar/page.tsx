"use client";

import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";
import { KunjunganListView } from "@/modules/kunjungan/views/kunjungan-list-view";
import { KeluargaPengajuanListView } from "@/modules/kunjungan/views/keluarga-pengajuan-list-view";

export default function KunjunganDaftarPage() {
  const { role } = useAuth();
  if (role === ROLES.KELUARGA) {
    return <KeluargaPengajuanListView />;
  }
  return <KunjunganListView />;
}