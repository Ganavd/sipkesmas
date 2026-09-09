"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KunjunganIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/kunjungan/daftar");
  }, [router]);

  return null;
}

