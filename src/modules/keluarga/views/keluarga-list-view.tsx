import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  Eye,
  HeartPulse,
  CheckCircle,
  UserX,
  UserCheck,
  Printer,
} from "lucide-react";

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
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonRows } from "@/components/common/skeleton-card";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RowActionButton } from "@/components/common/row-action-button";

import { keluargaService } from "@/services/keluarga.service";
import {
  STATUS_KELUARGA_OPTIONS,
  STATUS_LABEL,
  type KeluargaWithRelations,
  type StatusKeluarga,
} from "@/modules/keluarga/types";
import { KeluargaFormDialog } from "@/modules/keluarga/components/keluarga-form-dialog";
import { KeluargaStatusBadge } from "@/modules/keluarga/components/keluarga-status-badge";
import {
  softDeleteKeluarga,
  hardDeleteKeluarga,
  updateKeluarga,
  bulkHardDeleteKeluarga,
  bulkSoftDeleteKeluarga,
} from "@/lib/keluarga.functions";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";
import { Checkbox } from "@/components/ui/checkbox";
import { usePrintHeader } from "@/hooks/use-print-header";

type StatusFilter = "all" | StatusKeluarga;
type WorkflowFilter = "all" | "draft" | "registered";

interface KeluargaListViewProps {
  defaultWorkflow?: WorkflowFilter;
  lockedWorkflow?: boolean;
  title?: string;
  description?: string;
  tab?: string;
}

export function KeluargaListView({
  defaultWorkflow = "all",
  lockedWorkflow = false,
  title,
  description,
}: KeluargaListViewProps = {}) {
  const { role } = useAuth();
  const { printHeader, getPrintFilename } = usePrintHeader();
  const router = useRouter();
  const [rows, setRows] = useState<KeluargaWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"aktif_only" | "deleted_only" | "all">("aktif_only");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KeluargaWithRelations | null>(null);
  const [toggleTarget, setToggleTarget] = useState<KeluargaWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KeluargaWithRelations | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<KeluargaWithRelations | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkSoftDeleteConfirmOpen, setBulkSoftDeleteConfirmOpen] = useState(false);

  // Table UI State
  const [kodeFilter, setKodeFilter] = useState("");
  const [namaFilter, setNamaFilter] = useState("");
  const [kkFilter, setKkFilter] = useState("");
  const [anggotaFilter, setAnggotaFilter] = useState("");
  const [puskesmasFilter, setPuskesmasFilter] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [workflow, setWorkflow] = useState<WorkflowFilter>(defaultWorkflow);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSizeInput, setPageSizeInput] = useState("10");
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);

  const canMutate =
    role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS || role === ROLES.PERAWAT;
  const canDelete = role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS;

  const load = async () => {
    setLoading(true);
    try {
      setRows(await keluargaService.list({ includeDeleted: viewMode !== "aktif_only" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat data keluarga");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [viewMode]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (viewMode === "aktif_only" && (r.deleted_at || r.status !== "aktif")) return false;
      if (viewMode === "deleted_only" && !r.deleted_at) return false;
      if (status !== "all" && r.status !== status) return false;
      if (workflow === "draft" && r.is_registered) return false;
      if (workflow === "registered" && !r.is_registered) return false;
      if (kodeFilter && !r.keluarga_code.toLowerCase().includes(kodeFilter.toLowerCase()))
        return false;
      if (namaFilter && !r.kepala_keluarga.toLowerCase().includes(namaFilter.toLowerCase()))
        return false;
      if (kkFilter && !r.nomor_kk.toLowerCase().includes(kkFilter.toLowerCase())) return false;
      if (anggotaFilter && r.anggota_count.toString() !== anggotaFilter) return false;
      if (
        puskesmasFilter &&
        !(r.puskesmas_nama ?? "").toLowerCase().includes(puskesmasFilter.toLowerCase())
      )
        return false;
      return true;
    });
  }, [
    rows,
    status,
    workflow,
    kodeFilter,
    namaFilter,
    kkFilter,
    anggotaFilter,
    puskesmasFilter,
    viewMode,
  ]);

  const pageSize = limit > 0 ? limit : Math.max(1, filtered.length);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteKeluarga({ id: deleteTarget.id });
      toast.success("Keluarga telah diarsipkan");
      setDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengarsipkan keluarga");
    }
  };

  const confirmHardDelete = async () => {
    if (!hardDeleteTarget) return;
    try {
      await hardDeleteKeluarga({ id: hardDeleteTarget.id });
      toast.success("Keluarga telah dihapus permanen");
      setHardDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus permanen keluarga");
    }
  };

  const confirmToggleStatus = async () => {
    if (!toggleTarget) return;
    try {
      const newStatus = toggleTarget.status === "aktif" ? "nonaktif" : "aktif";
      await updateKeluarga({ id: toggleTarget.id, patch: { status: newStatus } });
      toast.success(`Keluarga berhasil di${newStatus === "aktif" ? "aktifkan" : "nonaktifkan"}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    } finally {
      setToggleTarget(null);
    }
  };

  const confirmBulkHardDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkHardDeleteKeluarga({ ids: Array.from(selectedIds) });
      toast.success(`${selectedIds.size} keluarga telah dihapus permanen`);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setBulkDeleteConfirmOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus massal");
    }
  };

  const confirmBulkSoftDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkSoftDeleteKeluarga({ ids: Array.from(selectedIds) });
      toast.success(`${selectedIds.size} keluarga telah diarsipkan`);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setBulkSoftDeleteConfirmOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengarsipkan massal");
    }
  };

  const selectedRows = rows.filter((r) => selectedIds.has(r.id));
  const allSelectedAreDeleted = selectedRows.length > 0 && selectedRows.every((r) => r.deleted_at);

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
    document.title = getPrintFilename("Daftar Manajemen Keluarga");
    setIsPrinting(true);
    window.setTimeout(() => {
      window.print();
      document.title = prev;
    }, 80);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={title ?? "Keluarga Binaan"}
        description={
          description ?? "Pusat data keluarga sebagai fondasi kunjungan, rekam medis, dan laporan."
        }
        actions={
          canMutate ? (
            <Button onClick={() => router.push("/keluarga/tambah")}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Keluarga
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col items-end gap-3 mb-8">
          {/* Baris 1: Mode Pilihan (Biru) */}
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
                  <Button variant="default" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Cetak Daftar
                  </Button>
                )}
                {allSelectedAreDeleted && role === ROLES.ADMIN_DINKES && (
                  <Button variant="destructive" onClick={() => setBulkDeleteConfirmOpen(true)}>
                    Hapus Permanen
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Baris 2: Tampilkan Tersembunyi (Kuning) & Limit (Hijau) */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                if (viewMode === "aktif_only") setViewMode("deleted_only");
                else if (viewMode === "deleted_only") setViewMode("all");
                else setViewMode("aktif_only");
              }}
            >
              {viewMode === "aktif_only"
                ? "Tampilkan yang tersembunyi"
                : viewMode === "deleted_only"
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
          ) : rows.length === 0 && viewMode === "aktif_only" ? (
            <EmptyState
              icon={HeartPulse}
              title="Belum ada data keluarga"
              description="Silakan tambahkan keluarga binaan untuk memulai pendataan kunjungan dan rekam medis."
              action={
                canMutate ? (
                  <Button onClick={() => router.push("/keluarga/tambah")}>
                    <Plus className="mr-2 h-4 w-4" /> Tambah Keluarga
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table className="w-full table-fixed border-collapse text-center">
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border">
                  <TableHead className="w-12 border-r border-border text-center font-bold px-0.5 py-3">
                    No
                  </TableHead>
                  <TableHead className="w-[11%] border-r border-border text-center font-bold py-3">
                    Kode
                  </TableHead>
                  <TableHead className="w-[20%] border-r border-border text-center font-bold py-3">
                    Kepala Keluarga
                  </TableHead>
                  <TableHead className="w-[15%] border-r border-border text-center font-bold py-3">
                    Nomor KK
                  </TableHead>
                  <TableHead className="w-[10%] border-r border-border text-center font-bold py-3">
                    Anggota
                  </TableHead>
                  <TableHead className="w-[15%] border-r border-border text-center font-bold py-3">
                    Puskesmas
                  </TableHead>
                  <TableHead className="w-[10%] border-r border-border text-center font-bold py-3">
                    Status
                  </TableHead>
                  <TableHead className="w-36 text-center font-bold py-3">Aksi</TableHead>
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
                      value={namaFilter}
                      onChange={(e) => setNamaFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={kkFilter}
                      onChange={(e) => setKkFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={anggotaFilter}
                      onChange={(e) => setAnggotaFilter(e.target.value)}
                      type="number"
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={puskesmasFilter}
                      onChange={(e) => setPuskesmasFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua</SelectItem>
                        <SelectItem value="aktif">Aktif</SelectItem>
                        <SelectItem value="nonaktif">Nonaktif</SelectItem>
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
                      colSpan={8}
                      className="h-32 text-center text-muted-foreground font-medium"
                    >
                      Data tidak ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((r, i) => (
                    <TableRow
                      key={r.id}
                      className={`${r.is_registered ? "bg-muted/10" : ""} ${r.deleted_at ? "bg-muted/50 grayscale opacity-80" : ""} border-b border-border hover:bg-muted/20`}
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
                      <TableCell className="border-r border-border font-mono text-sm font-bold text-center py-3">
                        {r.keluarga_code}
                      </TableCell>
                      <TableCell className="border-r border-border text-center py-3">
                        <Link
                          href={`/keluarga/${r.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {r.kepala_keluarga}
                        </Link>
                        <div className="text-xs text-muted-foreground">NIK {r.nik}</div>
                      </TableCell>
                      <TableCell className="border-r border-border font-mono text-xs text-center py-3">
                        {r.nomor_kk}
                      </TableCell>
                      <TableCell className="border-r border-border text-center text-sm py-3">
                        <span className="inline-flex items-center gap-1 justify-center">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" /> {r.anggota_count}
                        </span>
                      </TableCell>
                      <TableCell className="border-r border-border text-sm text-muted-foreground text-center py-3">
                        {r.puskesmas_nama ?? "-"}
                      </TableCell>
                      <TableCell className="border-r border-border text-center py-3">
                        <KeluargaStatusBadge status={r.status} isDeleted={!!r.deleted_at} />
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <div className="inline-flex items-center justify-center gap-1">
                          <RowActionButton
                            label="Lihat detail"
                            onClick={() => router.push(`/keluarga/${r.id}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </RowActionButton>
                          {!r.deleted_at && canDelete && (
                            <RowActionButton
                              label="Edit"
                              onClick={() => router.push(`/keluarga/${r.id}/edit`)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </RowActionButton>
                          )}
                          {!r.deleted_at && canDelete && (
                            <RowActionButton
                              label={r.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                              destructive={r.status === "aktif"}
                              onClick={() => setToggleTarget(r)}
                            >
                              {r.status === "aktif" ? (
                                <UserX className="h-3.5 w-3.5" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                            </RowActionButton>
                          )}
                          {!r.deleted_at && canDelete && (
                            <RowActionButton
                              label="Hapus"
                              destructive
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </RowActionButton>
                          )}
                          {r.deleted_at && role === ROLES.ADMIN_DINKES && (
                            <RowActionButton
                              label="Hapus permanen"
                              destructive
                              onClick={() => setHardDeleteTarget(r)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </RowActionButton>
                          )}
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

      <KeluargaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editTarget}
        onSaved={() => void load()}
      />
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(v) => !v && setToggleTarget(null)}
        title={`${toggleTarget?.status === "aktif" ? "Nonaktifkan" : "Aktifkan"} keluarga?`}
        description={`Status keluarga ${toggleTarget?.kepala_keluarga ?? ""} akan diubah menjadi ${toggleTarget?.status === "aktif" ? "nonaktif" : "aktif"}.`}
        confirmLabel="Ya, Lanjutkan"
        onConfirm={confirmToggleStatus}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Hapus keluarga?"
        description={`Data keluarga ${deleteTarget?.kepala_keluarga ?? ""} akan dihapus. Semua yang berhubungan akan diputuskan.`}
        confirmLabel="Ya, Hapus"
        destructive
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={!!hardDeleteTarget}
        onOpenChange={(v) => !v && setHardDeleteTarget(null)}
        title="Hapus Permanen?"
        description={`Apakah Anda yakin ingin menghapus data keluarga ${hardDeleteTarget?.kepala_keluarga ?? ""}? Semua data yang dimiliki akan musnah dan tidak bisa dipulihkan.`}
        confirmLabel="Ya, Hapus"
        destructive
        onConfirm={confirmHardDelete}
      />
      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        title="Hapus Permanen Massal?"
        description={`${selectedIds.size} data keluarga akan dihapus permanen beserta semua kunjungan & anggota terkait. Tidak bisa dipulihkan.`}
        confirmLabel="Ya, Hapus Permanen"
        destructive
        onConfirm={confirmBulkHardDelete}
      />
      <ConfirmDialog
        open={bulkSoftDeleteConfirmOpen}
        onOpenChange={setBulkSoftDeleteConfirmOpen}
        title="Arsipkan Keluarga Massal?"
        description={`${selectedIds.size} data keluarga yang dipilih akan diarsipkan (soft delete). Data dapat dipulihkan nanti.`}
        confirmLabel="Ya, Arsipkan"
        destructive
        onConfirm={confirmBulkSoftDelete}
      />

      {/* Print Section — hanya terlihat saat window.print() */}
      {isPrinting && (
        <div className="askep-print-only">
          <section className="bg-white text-black px-8 py-6">
            <div className="mb-5 text-center">
              <div className="text-sm font-bold uppercase">DAFTAR MANAJEMEN KELUARGA</div>
              <div className="text-[11px] font-medium uppercase mt-0.5">{printHeader}</div>
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="w-8 border border-black px-1.5 py-1">No</th>
                  <th className="border border-black px-1.5 py-1">Kode</th>
                  <th className="border border-black px-1.5 py-1">Kepala Keluarga</th>
                  <th className="border border-black px-1.5 py-1">Nomor KK</th>
                  <th className="border border-black px-1.5 py-1">Anggota</th>
                  <th className="border border-black px-1.5 py-1">Puskesmas</th>
                  <th className="border border-black px-1.5 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((r, index) => (
                  <tr key={r.id}>
                    <td className="border border-black px-1.5 py-1 text-center">{index + 1}</td>
                    <td className="border border-black px-1.5 py-1 font-mono">{r.keluarga_code}</td>
                    <td className="border border-black px-1.5 py-1">
                      {r.kepala_keluarga}
                      <span className="block text-[10px] text-gray-600">NIK: {r.nik}</span>
                    </td>
                    <td className="border border-black px-1.5 py-1 font-mono">{r.nomor_kk}</td>
                    <td className="border border-black px-1.5 py-1 text-center">
                      {r.anggota_count}
                    </td>
                    <td className="border border-black px-1.5 py-1">{r.puskesmas_nama ?? "-"}</td>
                    <td className="border border-black px-1.5 py-1 text-center capitalize">
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
