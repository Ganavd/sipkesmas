"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Pencil, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RowActionButton } from "@/components/common/row-action-button";
import { Checkbox } from "@/components/ui/checkbox";

import {
  JENIS_KUNJUNGAN_LABEL,
  JENIS_KUNJUNGAN_OPTIONS,
  STATUS_KUNJUNGAN_LABEL,
  STATUS_KUNJUNGAN_OPTIONS,
  deriveStatusKunjungan,
  TINDAKAN_KUNJUNGAN_LABEL,
  TINDAKAN_KUNJUNGAN_OPTIONS,
  type KunjunganWithRelations,
} from "@/modules/kunjungan/types";
import { KunjunganStatusBadge } from "@/modules/kunjungan/components/kunjungan-status-badge";
import { KunjunganTindakanBadge } from "@/modules/kunjungan/components/kunjungan-tindakan-badge";
import { formatTanggalWaktu } from "@/modules/kunjungan/utils/format";
import { bulkHardDeleteKunjungan, softDeleteKunjungan } from "@/actions/kunjungan";
import { getKunjunganActions } from "@/modules/kunjungan/utils/permissions";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";
import { usePrintHeader } from "@/hooks/use-print-header";

const PAGE_SIZE = 10;

interface KunjunganTableProps {
  rows: KunjunganWithRelations[];
  onChanged?: () => void;
  deletedMode?: "active" | "deleted" | "all";
  onToggleDeleted?: () => void;
  /** Judul yang ditampilkan saat cetak */
  printTitle?: string;
  /** Slot kiri toolbar (misal DateRangePicker dari parent) */
  dateRangeSlot?: React.ReactNode;
}

export function KunjunganTable({
  rows,
  onChanged,
  deletedMode = "active",
  onToggleDeleted,
  printTitle = "Daftar Kunjungan",
  dateRangeSlot,
}: KunjunganTableProps) {
  const { role } = useAuth();
  const isKeluarga = role === ROLES.KELUARGA;
  const isDinkes = role === ROLES.ADMIN_DINKES;
  const { printHeader, getPrintFilename } = usePrintHeader();

  // Asal Puskesmas ditampilkan untuk Admin Dinkes & Keluarga
  const showPuskesmas = isDinkes || isKeluarga;
  // Keluarga ditampilkan untuk semua staf (bukan role Keluarga)
  const showKeluarga = !isKeluarga;

  const [tanggalFilter, setTanggalFilter] = useState("");
  const [halFilter, setHalFilter] = useState("");
  const [asalPuskesmasFilter, setAsalPuskesmasFilter] = useState("");
  const [keluargaFilter, setKeluargaFilter] = useState("");
  const [jenisFilter, setJenisFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tindakanFilter, setTindakanFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkHardDeleteConfirmOpen, setBulkHardDeleteConfirmOpen] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSizeInput, setPageSizeInput] = useState("10");
  const [limit, setLimit] = useState(10);
  const [isPrinting, setIsPrinting] = useState(false);
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const allSelectedDeleted = selectedRows.length > 0 && selectedRows.every((row) => row.deleted_at);
  const allSelectedActive = selectedRows.length > 0 && selectedRows.every((row) => !row.deleted_at);
  const allSelectedCanDelete =
    allSelectedActive &&
    selectedRows.every((row) => {
      const status = deriveStatusKunjungan(row);
      return getKunjunganActions(role, status, row.tindakan).canDelete;
    });

  // Sorting: newest date inputs first
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const timeA = new Date(a.created_at || a.tanggal_kunjungan).getTime();
      const timeB = new Date(b.created_at || b.tanggal_kunjungan).getTime();
      return timeB - timeA;
    });
  }, [rows]);

  const filtered = useMemo(() => {
    return sortedRows.filter((r) => {
      const status = deriveStatusKunjungan(r);
      if (
        tanggalFilter &&
        !formatTanggalWaktu(r.tanggal_kunjungan).toLowerCase().includes(tanggalFilter.toLowerCase())
      )
        return false;
      if (halFilter && !(r.perihal ?? "").toLowerCase().includes(halFilter.toLowerCase()))
        return false;
      if (
        showPuskesmas &&
        asalPuskesmasFilter &&
        !(r.puskesmas_nama ?? "").toLowerCase().includes(asalPuskesmasFilter.toLowerCase())
      )
        return false;
      if (
        showKeluarga &&
        keluargaFilter &&
        !(r.keluarga_nama ?? "").toLowerCase().includes(keluargaFilter.toLowerCase())
      )
        return false;
      if (jenisFilter !== "all" && r.jenis_kunjungan !== jenisFilter) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (tindakanFilter !== "all" && r.tindakan !== tindakanFilter) return false;
      return true;
    });
  }, [
    sortedRows,
    tanggalFilter,
    halFilter,
    showPuskesmas,
    asalPuskesmasFilter,
    showKeluarga,
    keluargaFilter,
    jenisFilter,
    statusFilter,
    tindakanFilter,
  ]);

  const pageSize = limit > 0 ? limit : Math.max(1, filtered.length);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const confirmBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    try {
      const activeRows = selectedRows.filter((row) => !row.deleted_at);
      await Promise.all(activeRows.map((row) => softDeleteKunjungan({ id: row.id })));
      toast.success(`${activeRows.length} kunjungan dihapus`);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setBulkDeleteConfirmOpen(false);
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus kunjungan");
    }
  };

  const totalCols = 7 + (showPuskesmas ? 1 : 0) + (showKeluarga ? 1 : 0);

  useEffect(() => {
    const clearPrint = () => setIsPrinting(false);
    window.addEventListener("afterprint", clearPrint);
    return () => window.removeEventListener("afterprint", clearPrint);
  }, []);

  const handlePrint = () => {
    if (selectedIds.size === 0) {
      toast.error("Pilih minimal satu data untuk dicetak");
      return;
    }
    const prev = document.title;
    document.title = getPrintFilename(printTitle);
    setIsPrinting(true);
    window.setTimeout(() => {
      window.print();
      document.title = prev;
    }, 80);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 mb-8">
        {/* Baris 1: DateRange (kiri) + Mode Pilihan (kanan) */}
        <div className="flex items-center justify-between gap-3">
          <div>{dateRangeSlot}</div>
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
                  <Button variant="default" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Cetak Daftar
                  </Button>
                  {allSelectedCanDelete && (
                    <Button variant="destructive" onClick={() => setBulkDeleteConfirmOpen(true)}>
                      Hapus
                    </Button>
                  )}
                  {allSelectedDeleted && isDinkes && (
                    <Button
                      variant="destructive"
                      onClick={() => setBulkHardDeleteConfirmOpen(true)}
                    >
                      Hapus Permanen
                    </Button>
                  )}
                </>
              )}
            </>
          )}
          </div>
        </div>

        {/* Baris 2: Tampilkan Tersembunyi (Kuning) & Limit (Hijau) */}
        <div className="flex items-center justify-end gap-4">
          {onToggleDeleted && (
            <Button variant="outline" onClick={onToggleDeleted}>
              {deletedMode === "active"
                ? "Tampilkan yang tersembunyi"
                : deletedMode === "deleted"
                  ? "Tampilkan semua"
                  : "Sembunyikan yang ditampilkan"}
            </Button>
          )}
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
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table className="w-full table-fixed border-collapse text-center">
          <TableHeader className="bg-muted/40">
            <TableRow className="border-b border-border">
              <TableHead className="w-8 border-r border-border text-center font-bold px-0.5 py-3">
                No
              </TableHead>
              <TableHead className="w-[13%] border-r border-border text-center font-bold py-3">
                Tanggal
              </TableHead>
              <TableHead className="w-[10%] border-r border-border text-center font-bold py-3">
                Kode
              </TableHead>
              <TableHead className="w-[20%] border-r border-border text-center font-bold py-3">
                Hal
              </TableHead>
              {showPuskesmas && (
                <TableHead className="w-[13%] border-r border-border text-center font-bold py-3">
                  Asal Puskesmas
                </TableHead>
              )}
              {showKeluarga && (
                <TableHead className="w-[17%] border-r border-border text-center font-bold py-3">
                  Keluarga
                </TableHead>
              )}
              <TableHead className="w-[12%] border-r border-border text-center font-bold py-3">
                Jenis
              </TableHead>
              <TableHead className="w-[9%] border-r border-border text-center font-bold py-3">
                Status
              </TableHead>
              <TableHead className="w-[9%] border-r border-border text-center font-bold py-3">
                Tindakan
              </TableHead>
              <TableHead className="w-8 text-center font-bold px-0.5 py-3">Aksi</TableHead>
            </TableRow>

            {/* Filter inputs header row */}
            <TableRow className="border-b border-border bg-background hover:bg-transparent">
              <TableHead className="border-r border-border p-1 text-center" />
              <TableHead className="border-r border-border p-1.5">
                <Input
                  value={tanggalFilter}
                  onChange={(e) => setTanggalFilter(e.target.value)}
                  placeholder=""
                  className="h-8 text-xs text-center"
                />
              </TableHead>
              <TableHead className="border-r border-border p-1.5" />
              <TableHead className="border-r border-border p-1.5">
                <Input
                  value={halFilter}
                  onChange={(e) => setHalFilter(e.target.value)}
                  placeholder=""
                  className="h-8 text-xs text-center"
                />
              </TableHead>
              {showPuskesmas && (
                <TableHead className="border-r border-border p-1.5">
                  <Input
                    value={asalPuskesmasFilter}
                    onChange={(e) => setAsalPuskesmasFilter(e.target.value)}
                    placeholder=""
                    className="h-8 text-xs text-center"
                  />
                </TableHead>
              )}
              {showKeluarga && (
                <TableHead className="border-r border-border p-1.5">
                  <Input
                    value={keluargaFilter}
                    onChange={(e) => setKeluargaFilter(e.target.value)}
                    placeholder=""
                    className="h-8 text-xs text-center"
                  />
                </TableHead>
              )}
              <TableHead className="border-r border-border p-1.5">
                <Select value={jenisFilter} onValueChange={setJenisFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    {JENIS_KUNJUNGAN_OPTIONS.map((j) => (
                      <SelectItem key={j} value={j}>
                        {JENIS_KUNJUNGAN_LABEL[j]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableHead>
              <TableHead className="border-r border-border p-1.5">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    {STATUS_KUNJUNGAN_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_KUNJUNGAN_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableHead>
              <TableHead className="border-r border-border p-1.5">
                <Select value={tindakanFilter} onValueChange={setTindakanFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    {TINDAKAN_KUNJUNGAN_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TINDAKAN_KUNJUNGAN_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableHead>
              <TableHead className="p-0 text-center" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalCols}
                  className="h-32 text-center text-muted-foreground font-medium"
                >
                  Data tidak ditemukan
                </TableCell>
              </TableRow>
            ) : (
              paged.map((r, i) => {
                const status = deriveStatusKunjungan(r);
                const { canEdit } = isKeluarga
                  ? { canEdit: false, canDelete: false }
                  : getKunjunganActions(role, status, r.tindakan);

                return (
                  <TableRow
                    key={r.id}
                    className={`border-b border-border hover:bg-muted/20 ${r.deleted_at ? "bg-muted/50 grayscale opacity-80" : ""}`}
                  >
                    <TableCell className="border-r border-border text-center font-medium px-0.5 py-3">
                      {isSelectionMode ? (
                        <div className="flex justify-center">
                          <Checkbox
                            className="h-5 w-5"
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(selectedIds);
                              if (checked) newSet.add(r.id);
                              else newSet.delete(r.id);
                              setSelectedIds(newSet);
                            }}
                          />
                        </div>
                      ) : (
                        (page - 1) * pageSize + i + 1
                      )}
                    </TableCell>
                    <TableCell className="border-r border-border text-center text-xs py-3 px-2">
                      {formatTanggalWaktu(r.tanggal_kunjungan)}
                    </TableCell>
                    <TableCell className="border-r border-border text-center font-mono text-xs py-3 px-2">
                      {r.kunjungan_code?.startsWith("DRAFT-") ? "DRAF" : r.kunjungan_code || "-"}
                    </TableCell>
                    <TableCell className="border-r border-border text-center text-xs py-3 px-2">
                      <span className="break-words whitespace-normal leading-relaxed">
                        {r.perihal || "-"}
                      </span>
                    </TableCell>
                    {showPuskesmas && (
                      <TableCell className="border-r border-border text-center text-xs font-medium py-3 px-2">
                        {r.puskesmas_nama ?? "-"}
                      </TableCell>
                    )}
                    {showKeluarga && (
                      <TableCell className="border-r border-border text-center py-3 px-2">
                        <p className="font-medium text-foreground text-xs">
                          {r.keluarga_nama ?? "-"}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{r.keluarga_code}</p>
                      </TableCell>
                    )}
                    <TableCell className="border-r border-border text-center text-xs py-3 px-2">
                      {JENIS_KUNJUNGAN_LABEL[r.jenis_kunjungan]}
                    </TableCell>
                    <TableCell className="border-r border-border text-center py-3 px-2">
                      <KunjunganStatusBadge status={status} />
                    </TableCell>
                    <TableCell className="border-r border-border text-center py-3 px-2">
                      <KunjunganTindakanBadge tindakan={r.tindakan} />
                    </TableCell>
                    <TableCell className="text-center py-3 px-1">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <Link href={`/kunjungan/${r.id}`}>
                          <RowActionButton label="Lihat">
                            <Eye className="h-3.5 w-3.5" />
                          </RowActionButton>
                        </Link>
                        {canEdit && !r.deleted_at && (
                          <Link href={`/kunjungan/${r.id}/edit`}>
                            <RowActionButton label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </RowActionButton>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
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

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        title="Hapus kunjungan terpilih?"
        description={`${selectedRows.filter((row) => !row.deleted_at).length} kunjungan akan dipindahkan ke data tersembunyi.`}
        confirmLabel="Ya, Hapus"
        destructive
        onConfirm={confirmBulkDelete}
      />
      <ConfirmDialog
        open={bulkHardDeleteConfirmOpen}
        onOpenChange={setBulkHardDeleteConfirmOpen}
        title="Hapus permanen kunjungan terpilih?"
        description={`${selectedRows.length} kunjungan tersembunyi beserta Askep dan tim terkait akan dihapus permanen.`}
        confirmLabel="Ya, Hapus Permanen"
        destructive
        onConfirm={async () => {
          await bulkHardDeleteKunjungan({ ids: selectedRows.map((row) => row.id) });
          setSelectedIds(new Set());
          setIsSelectionMode(false);
          setBulkHardDeleteConfirmOpen(false);
          onChanged?.();
        }}
      />

      {/* Print Section — hanya terlihat saat window.print() */}
      {isPrinting && (
        <div className="askep-print-only">
          <section className="bg-white text-black px-8 py-6">
            <div className="mb-5 text-center">
              <div className="text-sm font-bold uppercase">{printTitle}</div>
              <div className="text-[11px] font-medium uppercase mt-0.5">{printHeader}</div>
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="w-8 border border-black px-1.5 py-1">No</th>
                  <th className="border border-black px-1.5 py-1">Tanggal</th>
                  <th className="border border-black px-1.5 py-1">Kode</th>
                  <th className="border border-black px-1.5 py-1">Perihal</th>
                  {showPuskesmas && <th className="border border-black px-1.5 py-1">Puskesmas</th>}
                  {showKeluarga && <th className="border border-black px-1.5 py-1">Keluarga</th>}
                  <th className="border border-black px-1.5 py-1">Jenis</th>
                  <th className="border border-black px-1.5 py-1">Status</th>
                  <th className="border border-black px-1.5 py-1">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((r, index) => {
                  const status = deriveStatusKunjungan(r);
                  return (
                    <tr key={r.id}>
                      <td className="border border-black px-1.5 py-1 text-center">{index + 1}</td>
                      <td className="border border-black px-1.5 py-1">{formatTanggalWaktu(r.tanggal_kunjungan)}</td>
                      <td className="border border-black px-1.5 py-1 font-mono">
                        {r.kunjungan_code?.startsWith("DRAFT-") ? "DRAF" : r.kunjungan_code || "-"}
                      </td>
                      <td className="border border-black px-1.5 py-1">{r.perihal || "-"}</td>
                      {showPuskesmas && (
                        <td className="border border-black px-1.5 py-1">{r.puskesmas_nama ?? "-"}</td>
                      )}
                      {showKeluarga && (
                        <td className="border border-black px-1.5 py-1">
                          {r.keluarga_nama ?? "-"}
                          {r.keluarga_code && <span className="block font-mono text-[10px]">{r.keluarga_code}</span>}
                        </td>
                      )}
                      <td className="border border-black px-1.5 py-1">{JENIS_KUNJUNGAN_LABEL[r.jenis_kunjungan]}</td>
                      <td className="border border-black px-1.5 py-1">{STATUS_KUNJUNGAN_LABEL[status]}</td>
                      <td className="border border-black px-1.5 py-1">{TINDAKAN_KUNJUNGAN_LABEL[r.tindakan] ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
