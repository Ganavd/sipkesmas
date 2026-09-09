"use client";

import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonRows } from "@/components/common/skeleton-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { auditService, type AuditLogRow } from "@/services/audit.service";
import { DateRangePicker } from "@/components/common/date-range-picker";

const ACTION_LABELS: Record<string, string> = {
  create: "Dibuat",
  ajukan_resmi: "Diajukan resmi (Keluarga)",
  ubah_jadwal: "Jadwal diubah (Keluarga)",
  delete: "Dihapus",
  update: "Diperbarui",
  tindak_lanjut_1: "TL1 — Mulai diproses",
  tindak_lanjut_2: "TL2 — Rekam medis / Askep dibuat",
  selesai: "Selesai (ditutup)",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function KunjunganLogView() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined, to: undefined,
  });
  const [appliedRange, setAppliedRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined, to: undefined,
  });

  // Filter state
  const [waktuFilter, setWaktuFilter] = useState("");
  const [keteranganFilter, setKeteranganFilter] = useState("");
  const [perubahanFilter, setPerubahanFilter] = useState("__all__");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setRows(
          await auditService.list({
            limit: 200,
            entity: "kunjungan",
            startDate: appliedRange.from,
            endDate: appliedRange.to,
          })
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memuat log kunjungan");
      } finally {
        setLoading(false);
      }
    })();
  }, [appliedRange]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (perubahanFilter !== "__all__" && r.action !== perubahanFilter) return false;
      if (waktuFilter) {
        const dateStr = formatDate(r.created_at);
        if (!dateStr.toLowerCase().includes(waktuFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, perubahanFilter, waktuFilter]);

  // Opsi dropdown: selalu tampilkan semua dari ACTION_LABELS,
  // plus tambahkan action yang ada di data tapi belum terdaftar
  const actionOptions = useMemo(() => {
    const base = Object.entries(ACTION_LABELS).map(([key, label]) => ({ key, label }));
    const knownKeys = new Set(Object.keys(ACTION_LABELS));
    const extra = Array.from(new Set(rows.map((r) => r.action)))
      .filter((k) => !knownKeys.has(k))
      .map((k) => ({ key: k, label: k }));
    return [...base, ...extra];
  }, [rows]);

  const dateTitle = appliedRange.from && appliedRange.to
    ? ` Tanggal ${format(appliedRange.from, "dd MMMM", { locale: localeId })} - ${format(appliedRange.to, "dd MMMM yyyy", { locale: localeId })}`
    : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Log Kunjungan${dateTitle}`}
        description="Riwayat perubahan kunjungan — dibuat, diedit, dihapus, atau diajukan ulang jadwalnya."
        breadcrumb={[{ label: "Pendataan" }, { label: "Log Kunjungan" }]}
      />

      {/* Toolbar: DateRangePicker kiri */}
      <div className="flex items-center justify-between gap-3">
        <DateRangePicker
          startDate={dateRange.from}
          endDate={dateRange.to}
          onChange={setDateRange}
          onApply={() => setAppliedRange(dateRange)}
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={History}
              title="Belum ada riwayat"
              description="Perubahan pada kunjungan pada rentang tanggal ini akan tercatat di sini."
            />
          </div>
        ) : (
          <Table className="w-full table-fixed border-collapse">
            <TableHeader className="bg-muted/40">
              {/* Baris judul kolom */}
              <TableRow className="border-b border-border">
                <TableHead className="w-14 border-r border-border text-center font-bold px-2 py-3">
                  No
                </TableHead>
                <TableHead className="w-[20%] border-r border-border text-center font-bold py-3">
                  Tanggal
                </TableHead>
                <TableHead className="w-[40%] border-r border-border text-center font-bold py-3">
                  Keterangan
                </TableHead>
                <TableHead className="text-center font-bold py-3">
                  Perubahan
                </TableHead>
              </TableRow>
              {/* Baris filter */}
              <TableRow className="border-b border-border bg-background hover:bg-transparent">
                <TableHead className="border-r border-border p-1 text-center" />
                <TableHead className="border-r border-border p-1.5">
                  <Input
                    value={waktuFilter}
                    onChange={(e) => setWaktuFilter(e.target.value)}
                    className="h-8 text-xs text-center"
                  />
                </TableHead>
                <TableHead className="border-r border-border p-1.5">
                  <Input
                    value={keteranganFilter}
                    onChange={(e) => setKeteranganFilter(e.target.value)}
                    className="h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="p-1.5">
                  <Select value={perubahanFilter} onValueChange={setPerubahanFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Semua" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Semua</SelectItem>
                      {actionOptions.map(({ key, label }) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                    Tidak ada data sesuai filter.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r, i) => (
                  <TableRow key={r.id} className="border-b border-border last:border-0">
                    <TableCell className="border-r border-border text-center font-medium py-4 px-2">
                      {i + 1}
                    </TableCell>
                    <TableCell className="border-r border-border text-sm text-muted-foreground whitespace-nowrap py-4 px-3">
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell className="border-r border-border text-sm text-muted-foreground py-4 px-3">
                      {r.description ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm font-medium py-4 px-3">
                      {ACTION_LABELS[r.action] ?? r.action}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}