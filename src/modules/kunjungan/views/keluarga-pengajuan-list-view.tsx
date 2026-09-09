"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { subDays, format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonRows } from "@/components/common/skeleton-card";
import { KunjunganTable } from "@/modules/kunjungan/components/kunjungan-table";
import { DateRangePicker } from "@/components/common/date-range-picker";
import { kunjunganService } from "@/services/kunjungan.service";
import type { KunjunganWithRelations } from "@/modules/kunjungan/types";

export function KeluargaPengajuanListView() {
  const [rows, setRows] = useState<KunjunganWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

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
      setRows(await kunjunganService.list({
        startDate: appliedRange.from,
        endDate: appliedRange.to,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat kunjungan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [appliedRange]);

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
        title={`Daftar Pengajuan Kunjungan${dateTitle}`}
        description="Kunjungan yang diajukan petugas puskesmas untuk keluarga Anda."
        breadcrumb={[{ label: "Pendataan" }, { label: "Daftar Pengajuan Kunjungan" }]}
      />

      {loading ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Belum ada pengajuan kunjungan"
          description="Kunjungan yang diajukan petugas puskesmas pada rentang tanggal ini akan muncul di sini."
        />
      ) : (
        <KunjunganTable rows={rows} onChanged={load} printTitle={`Daftar Pengajuan Kunjungan${dateTitle}`} dateRangeSlot={dateRangeSlot} />
      )}
    </div>
  );
}