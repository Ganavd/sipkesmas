"use client";

import { useParams } from "next/navigation";
import { TindakLanjut2View } from "@/src/modules/kunjungan/views/tindak-lanjut-2-view";

export default function TindakLanjut2Page() {
  const params = useParams();
  const kunjunganId = params.kunjunganId as string;

  return <TindakLanjut2View id={kunjunganId} />;
}
