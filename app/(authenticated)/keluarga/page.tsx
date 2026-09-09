"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KeluargaIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/keluarga/log");
  }, [router]);

  return null;
}
