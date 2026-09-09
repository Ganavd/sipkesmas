"use client";

import { Pill } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";

export default function ObatPage() {
  return (
    <EmptyState
      icon={Pill}
      title="Manajemen Obat (Segera Hadir)"
      description="Modul manajemen resep dan stok obat dasar sedang dalam tahap perancangan."
    />
  );
}
