"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { subDays, format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonRows } from "@/components/common/skeleton-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditService, type AuditLogRow } from "@/services/audit.service";
import { DateRangePicker } from "@/components/common/date-range-picker";

const ACTION_LABELS: Record<string, string> = {
  create: "Dibuat",
  update: "Diperbarui",
  delete: "Dihapus",
  hard_delete: "Dihapus permanen",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function AskepLogView() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [appliedRange, setAppliedRange] = useState<{ from: Date | undefined; to: Date | undefined }>(dateRange);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setRows(
          await auditService.list({
            limit: 200,
            entity: "asuhan_keperawatan",
            startDate: appliedRange.from,
            endDate: appliedRange.to,
          })
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memuat log asuhan keperawatan");
      } finally {
        setLoading(false);
      }
    })();
  }, [appliedRange]);

  const dateTitle = appliedRange.from && appliedRange.to
    ? ` Tanggal ${format(appliedRange.from, "dd MMMM", { locale: localeId })} - ${format(appliedRange.to, "dd MMMM yyyy", { locale: localeId })}`
    : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Log Asuhan Keperawatan${dateTitle}`}
        description="Riwayat perubahan asuhan keperawatan — dibuat, diedit, atau dihapus."
        breadcrumb={[{ label: "Pendataan" }, { label: "Log Asuhan Keperawatan" }]}
      />

      <div className="flex items-center mb-6">
        <DateRangePicker
          startDate={dateRange.from}
          endDate={dateRange.to}
          onChange={setDateRange}
          onApply={() => setAppliedRange(dateRange)}
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={History}
              title="Belum ada riwayat"
              description="Perubahan pada asuhan keperawatan pada rentang tanggal ini akan tercatat di sini."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">No</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Perubahan</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-center font-medium">{i + 1}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-sm font-medium">{ACTION_LABELS[r.action] ?? r.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.description ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
