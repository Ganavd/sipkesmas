"use client";

import { useParams } from "next/navigation";
import { TindakLanjut1View } from "@/src/modules/kunjungan/views/tindak-lanjut-1-view";

export default function TindakLanjut1Page() {
  const params = useParams();
  const kunjunganId = params.kunjunganId as string;

  return <TindakLanjut1View id={kunjunganId} />;
}
