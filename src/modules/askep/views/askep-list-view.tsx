"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Stethoscope, Eye, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { subDays, format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonRows } from "@/components/common/skeleton-card";
import { askepService, type AskepRow } from "@/services/askep.service";
import { Checkbox } from "@/components/ui/checkbox";
import { AskepDocument } from "../components/askep-document";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DateRangePicker } from "@/components/common/date-range-picker";
import { softDeleteAskep, hardDeleteAskep } from "@/lib/askep.functions";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";
import { usePrintHeader } from "@/hooks/use-print-header";

type PrintMode = "list" | "documents" | null;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AskepListView() {
  const { role } = useAuth();
  const isDinkes = role === ROLES.ADMIN_DINKES;
  const { printHeader, getPrintFilename } = usePrintHeader();
  const [items, setItems] = useState<AskepRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Table UI State
  const [kodeFilter, setKodeFilter] = useState("");
  const [tanggalFilter, setTanggalFilter] = useState("");
  const [diagnosisFilter, setDiagnosisFilter] = useState("");
  const [petugasFilter, setPetugasFilter] = useState("");

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSizeInput, setPageSizeInput] = useState("10");
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [printMode, setPrintMode] = useState<PrintMode>(null);
  const [deletedMode, setDeletedMode] = useState<"active" | "deleted" | "all">("active");
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard" | null>(null);

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [appliedRange, setAppliedRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setItems(
          await askepService.list({
            includeDeleted: deletedMode === "all",
            deletedOnly: deletedMode === "deleted",
            startDate: appliedRange.from,
            endDate: appliedRange.to,
          }),
        );
      } catch (err) {
        toast.error("Gagal memuat data Asuhan Keperawatan");
      } finally {
        setLoading(false);
      }
    })();
  }, [deletedMode, appliedRange]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (kodeFilter && !(i.kunjungan_code ?? "").toLowerCase().includes(kodeFilter.toLowerCase()))
        return false;
      if (tanggalFilter) {
        const dateStr = new Date(i.tanggal).toLocaleDateString("id-ID");
        if (!dateStr.includes(tanggalFilter)) return false;
      }
      if (diagnosisFilter && !i.diagnosis.toLowerCase().includes(diagnosisFilter.toLowerCase()))
        return false;
      if (
        petugasFilter &&
        !(i.petugas_name ?? "").toLowerCase().includes(petugasFilter.toLowerCase())
      )
        return false;
      return true;
    });
  }, [items, kodeFilter, tanggalFilter, diagnosisFilter, petugasFilter]);

  const pageSize = limit > 0 ? limit : Math.max(1, filtered.length);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const allSelectedDeleted =
    selectedItems.length > 0 && selectedItems.every((item) => item.deleted_at);
  const allSelectedActive =
    selectedItems.length > 0 && selectedItems.every((item) => !item.deleted_at);
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  useEffect(() => {
    const clearPrintMode = () => setPrintMode(null);
    window.addEventListener("afterprint", clearPrintMode);
    return () => window.removeEventListener("afterprint", clearPrintMode);
  }, []);

  const handlePrint = (mode: PrintMode) => {
    if (selectedIds.size === 0) {
      toast.error("Pilih minimal satu asuhan keperawatan untuk dicetak");
      return;
    }
    const prev = document.title;
    document.title = getPrintFilename(
      mode === "list" ? "Daftar Asuhan Keperawatan" : "Dokumen Asuhan Keperawatan"
    );
    setPrintMode(mode);
    window.setTimeout(() => {
      window.print();
      document.title = prev;
    }, 150);
  };

  const dateTitle = appliedRange.from && appliedRange.to
    ? ` Tanggal ${format(appliedRange.from, "dd MMMM", { locale: localeId })} - ${format(appliedRange.to, "dd MMMM yyyy", { locale: localeId })}`
    : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Daftar Asuhan Keperawatan${dateTitle}`}
        description="Riwayat Asuhan Keperawatan yang telah dicatat."
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 mb-8">
          {/* Baris 1: DateRange (kiri) + Mode Pilihan (kanan) */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <DateRangePicker
                startDate={dateRange.from}
                endDate={dateRange.to}
                onChange={setDateRange}
                onApply={() => setAppliedRange(dateRange)}
              />
            </div>
            <div className="flex items-center gap-2">
            {!isSelectionMode ? (
              <Button variant="outline" onClick={() => setIsSelectionMode(true)}>
                Pilih
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedIds(new Set());
                  }}
                >
                  Batal
                </Button>
                <Button
                  variant={selectedIds.size > 0 ? "default" : "outline"}
                  onClick={() => {
                    if (selectedIds.size === 0) {
                      setSelectedIds(new Set(paged.map((r) => r.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                >
                  {selectedIds.size === 0 ? "Pilih Semua" : `Pilih ${selectedIds.size}`}
                </Button>
                {selectedIds.size > 0 && (
                  <>
                    <Button variant="default" onClick={() => handlePrint("list")}>
                      <Printer className="mr-2 h-4 w-4" />
                      Cetak Daftar
                    </Button>
                    <Button onClick={() => handlePrint("documents")}>
                      <Printer className="mr-2 h-4 w-4" />
                      Cetak Askep
                    </Button>
                    {isDinkes && allSelectedActive && (
                      <Button variant="destructive" onClick={() => setDeleteMode("soft")}>
                        <Trash2 className="mr-2 h-4 w-4" /> Hapus
                      </Button>
                    )}
                    {isDinkes && allSelectedDeleted && (
                      <Button variant="destructive" onClick={() => setDeleteMode("hard")}>
                        <Trash2 className="mr-2 h-4 w-4" /> Hapus Permanen
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

          {/* Baris 2: Limit (Hijau) */}
          <div className="flex items-center justify-end gap-4">
            <Button
              variant="outline"
              onClick={() =>
                setDeletedMode((mode) =>
                  mode === "active" ? "deleted" : mode === "deleted" ? "all" : "active",
                )
              }
            >
              {deletedMode === "active"
                ? "Tampilkan yang tersembunyi"
                : deletedMode === "deleted"
                  ? "Tampilkan semua"
                  : "Sembunyikan yang ditampilkan"}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Tampil:</span>
              <Input
                type="number"
                className="w-16 h-10 text-sm"
                value={pageSizeInput}
                onChange={(e) => {
                  setPageSizeInput(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  if (val > 0) setLimit(val);
                  else setLimit(0);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-4">
              <SkeletonRows rows={6} />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Stethoscope}
                title="Belum ada Asuhan Keperawatan"
                description="Data Asuhan Keperawatan ditambahkan melalui proses Tindak Lanjut 2 dari halaman Kunjungan."
              />
            </div>
          ) : (
            <Table className="w-full table-fixed border-collapse text-center">
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border">
                  <TableHead className="w-12 border-r border-border text-center font-bold px-0.5 py-3">
                    No
                  </TableHead>
                  <TableHead className="w-[20%] border-r border-border text-center font-bold py-3">
                    Kode Kunjungan
                  </TableHead>
                  <TableHead className="w-[15%] border-r border-border text-center font-bold py-3">
                    Tanggal
                  </TableHead>
                  <TableHead className="w-[30%] border-r border-border text-center font-bold py-3">
                    Diagnosis
                  </TableHead>
                  <TableHead className="w-[15%] border-r border-border text-center font-bold py-3">
                    Petugas
                  </TableHead>
                  <TableHead className="w-24 text-center font-bold py-3">Aksi</TableHead>
                </TableRow>
                <TableRow className="border-b border-border bg-background hover:bg-transparent">
                  <TableHead className="border-r border-border p-1 text-center" />
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={kodeFilter}
                      onChange={(e) => setKodeFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={tanggalFilter}
                      onChange={(e) => setTanggalFilter(e.target.value)}
                      placeholder="dd/mm/yyyy"
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={diagnosisFilter}
                      onChange={(e) => setDiagnosisFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={petugasFilter}
                      onChange={(e) => setPetugasFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="p-0 text-center" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground font-medium"
                    >
                      Data tidak ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((item, i) => (
                    <TableRow key={item.id} className="border-b border-border hover:bg-muted/20">
                      <TableCell className="border-r border-border text-center font-medium px-0.5 py-3">
                        {isSelectionMode ? (
                          <div className="flex justify-center">
                            <Checkbox
                              className="h-5 w-5"
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={(checked) => {
                                const newSet = new Set(selectedIds);
                                if (checked) newSet.add(item.id);
                                else newSet.delete(item.id);
                                setSelectedIds(newSet);
                              }}
                            />
                          </div>
                        ) : (
                          (page - 1) * pageSize + i + 1
                        )}
                      </TableCell>
                      <TableCell className="border-r border-border font-medium font-mono text-xs uppercase text-center py-3">
                        {item.kunjungan_code || "—"}
                      </TableCell>
                      <TableCell className="border-r border-border text-center py-3">
                        {new Date(item.tanggal).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell className="border-r border-border text-center truncate px-2 py-3">
                        {item.diagnosis}
                      </TableCell>
                      <TableCell className="border-r border-border text-center py-3">
                        {item.petugas_name || "—"}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <div className="inline-flex justify-center">
                          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Link href={`/askep/${item.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 mt-4 text-sm gap-4 bg-muted/20 rounded-xl">
            <span className="text-muted-foreground">
              Hal {page} dari {pageCount} ({filtered.length} baris)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteMode !== null}
        onOpenChange={(open) => !open && setDeleteMode(null)}
        title={deleteMode === "hard" ? "Hapus Askep permanen?" : "Hapus Askep?"}
        description={`${selectedItems.length} data Askep terpilih akan ${deleteMode === "hard" ? "dihapus permanen" : "dipindahkan ke data tersembunyi"}.`}
        confirmLabel={deleteMode === "hard" ? "Ya, Hapus Permanen" : "Ya, Hapus"}
        destructive
        onConfirm={async () => {
          const ids = selectedItems.map((item) => item.id);
          if (deleteMode === "hard") await hardDeleteAskep({ ids });
          else await softDeleteAskep({ ids });
          setSelectedIds(new Set());
          setIsSelectionMode(false);
          setDeleteMode(null);
          const refreshed = await askepService.list({
            includeDeleted: deletedMode === "all",
            deletedOnly: deletedMode === "deleted",
          });
          setItems(refreshed);
        }}
      />

      {printMode === "list" && (
        <div className="askep-print-only">
          <section className="bg-white text-black px-8 py-6">
            <div className="mb-5 text-center">
              <div className="text-sm font-bold uppercase">DAFTAR ASUHAN KEPERAWATAN</div>
              <div className="text-[11px] font-medium uppercase mt-0.5">{printHeader}</div>
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="w-8 border border-black px-1.5 py-1">No</th>
                  <th className="border border-black px-1.5 py-1">Tanggal/Jam</th>
                  <th className="border border-black px-1.5 py-1">Kode Kunjungan</th>
                  <th className="border border-black px-1.5 py-1">Keluarga</th>
                  <th className="border border-black px-1.5 py-1">Puskesmas</th>
                  <th className="border border-black px-1.5 py-1">Diagnosis</th>
                  <th className="border border-black px-1.5 py-1">Petugas</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((item, index) => (
                  <tr key={item.id}>
                    <td className="border border-black px-1.5 py-1 text-center">{index + 1}</td>
                    <td className="border border-black px-1.5 py-1">
                      {formatDateTime(item.tanggal)}
                    </td>
                    <td className="border border-black px-1.5 py-1">{item.kunjungan_code || "-"}</td>
                    <td className="border border-black px-1.5 py-1">
                      {item.kepala_keluarga || "-"}
                      <br />
                      <span>Kode: {item.keluarga_code || "-"}</span>
                    </td>
                    <td className="border border-black px-1.5 py-1">{item.puskesmas_nama || "-"}</td>
                    <td className="border border-black px-1.5 py-1">{item.diagnosis || "-"}</td>
                    <td className="border border-black px-1.5 py-1">{item.petugas_name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {printMode === "documents" && (
        <div className="askep-print-only">
          {selectedItems.map((item) => (
            <AskepDocument key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
