"use client";

import { FileBarChart } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";

export default function LaporanPage() {
  return (
    <EmptyState
      icon={FileBarChart}
      title="Laporan & Analitik (Segera Hadir)"
      description="Modul laporan analitik lanjutan dan ekspor data sedang dalam tahap perancangan."
    />
  );
}
