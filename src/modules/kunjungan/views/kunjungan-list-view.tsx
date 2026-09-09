"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ClipboardList } from "lucide-react";

import { subDays, format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonRows } from "@/components/common/skeleton-card";
import { KunjunganTable } from "@/modules/kunjungan/components/kunjungan-table";
import { DateRangePicker } from "@/components/common/date-range-picker";

import { kunjunganService } from "@/services/kunjungan.service";
import type { KunjunganWithRelations } from "@/modules/kunjungan/types";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";

export function KunjunganListView() {
  const router = useRouter();
  const { role } = useAuth();
  const canCreate = role === ROLES.PERAWAT;

  const [rows, setRows] = useState<KunjunganWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletedMode, setDeletedMode] = useState<"active" | "deleted" | "all">("active");

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [appliedRange, setAppliedRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const load = async () => {
    setLoading(true);
    try {
      setRows(
        await kunjunganService.list({
          includeDeleted: deletedMode === "all",
          deletedOnly: deletedMode === "deleted",
          startDate: appliedRange.from,
          endDate: appliedRange.to,
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat kunjungan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [deletedMode, appliedRange]);

  const dateTitle = appliedRange.from && appliedRange.to
    ? ` Tanggal ${format(appliedRange.from, "dd MMMM", { locale: localeId })} - ${format(appliedRange.to, "dd MMMM yyyy", { locale: localeId })}`
    : "";

  const dateRangeSlot = (
    <DateRangePicker
      startDate={dateRange.from}
      endDate={dateRange.to}
      onChange={setDateRange}
      onApply={() => setAppliedRange(dateRange)}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Daftar Kunjungan${dateTitle}`}
        description="Kunjungan yang diajukan untuk keluarga binaan."
        breadcrumb={[{ label: "Pendataan" }, { label: "Daftar Kunjungan" }]}
      />

      {loading ? (
        <SkeletonRows rows={6} />
      ) : (
        <KunjunganTable
          rows={rows}
          onChanged={load}
          deletedMode={deletedMode}
          printTitle={`Daftar Kunjungan${dateTitle}`}
          dateRangeSlot={dateRangeSlot}
          onToggleDeleted={() =>
            setDeletedMode((mode) =>
              mode === "active" ? "deleted" : mode === "deleted" ? "all" : "active",
            )
          }
        />
      )}
    </div>
  );
}
