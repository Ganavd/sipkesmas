"use client";

import { useParams } from "next/navigation";
import { KeluargaDetailView } from "@/src/modules/keluarga/views/keluarga-detail-view";

export default function KeluargaDetailPage() {
  const params = useParams();
  const keluargaId = params.keluargaId as string;

  return <KeluargaDetailView keluargaId={keluargaId} />;
}
