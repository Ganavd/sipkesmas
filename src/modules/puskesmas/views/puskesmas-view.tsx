import { useEffect, useState, useMemo } from "react";
import { Plus, Building2, Pencil, Power, Trash2 } from "lucide-react";
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
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonRows } from "@/components/common/skeleton-card";
import { StatusBadge } from "@/components/common/status-badge";
import { RowActionButton } from "@/components/common/row-action-button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { puskesmasService, type Puskesmas } from "@/services/puskesmas.service";
import { PuskesmasFormDialog } from "@/modules/puskesmas/components/puskesmas-form-dialog";
import { useRole } from "@/hooks/use-role";
import { ROLES } from "@/lib/constants/roles";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export function PuskesmasView() {
  const { hasRole } = useRole();
  const canManage = hasRole(ROLES.ADMIN_DINKES);

  const [items, setItems] = useState<Puskesmas[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Puskesmas | null>(null);
  const [deleting, setDeleting] = useState<Puskesmas | null>(null);

  // Table UI State
  const [kodeFilter, setKodeFilter] = useState("");
  const [namaFilter, setNamaFilter] = useState("");
  const [kecFilter, setKecFilter] = useState("");
  const [kabFilter, setKabFilter] = useState("");

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSizeInput, setPageSizeInput] = useState("10");
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await puskesmasService.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleStatus = async (p: Puskesmas) => {
    try {
      const next = p.status === "aktif" ? "nonaktif" : "aktif";
      await puskesmasService.toggleStatus(p.id, next);
      toast.success(`Status diubah menjadi ${next}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await puskesmasService.remove(deleting.id);
      toast.success(`Puskesmas ${deleting.nama_puskesmas} berhasil dihapus`);
      setDeleting(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus Puskesmas");
    }
  };

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (kodeFilter && !p.kode.toLowerCase().includes(kodeFilter.toLowerCase())) return false;
      if (namaFilter && !p.nama_puskesmas.toLowerCase().includes(namaFilter.toLowerCase()))
        return false;
      if (kecFilter && !(p.kecamatan ?? "").toLowerCase().includes(kecFilter.toLowerCase()))
        return false;
      if (kabFilter && !(p.kabupaten ?? "").toLowerCase().includes(kabFilter.toLowerCase()))
        return false;
      return true;
    });
  }, [items, kodeFilter, namaFilter, kecFilter, kabFilter]);

  const pageSize = limit > 0 ? limit : Math.max(1, filtered.length);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Puskesmas"
        description="Kelola data Puskesmas di bawah Dinas Kesehatan."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Puskesmas
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
                  <Button variant="secondary" disabled>
                    Cetak
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Baris 2: Limit (Hijau) - Tanpa tombol tersembunyi krn tdk ada soft delete di puskesmas */}
          <div className="flex items-center gap-4">
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

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-4">
              <SkeletonRows rows={5} />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Building2}
                title="Belum ada Puskesmas"
                description="Tambahkan Puskesmas pertama untuk memulai."
              />
            </div>
          ) : (
            <Table className="w-full table-fixed border-collapse text-center">
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border">
                  <TableHead className="w-[7%] border-r border-border text-center font-bold px-0.5 py-3">
                    No
                  </TableHead>
                  <TableHead className="w-[11%] border-r border-border text-center font-bold py-3">
                    Kode
                  </TableHead>
                  <TableHead className="w-[24%] border-r border-border text-center font-bold py-3">
                    Nama Puskesmas
                  </TableHead>
                  <TableHead className="w-[17%] border-r border-border text-center font-bold py-3">
                    Kecamatan
                  </TableHead>
                  <TableHead className="w-[17%] border-r border-border text-center font-bold py-3">
                    Kabupaten
                  </TableHead>
                  <TableHead className="w-[10%] border-r border-border text-center font-bold py-3">
                    Status
                  </TableHead>
                  {canManage && (
                    <TableHead className="w-[14%] text-center font-bold px-0.5 py-3">
                      Aksi
                    </TableHead>
                  )}
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
                      value={kecFilter}
                      onChange={(e) => setKecFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={kabFilter}
                      onChange={(e) => setKabFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5 text-center" />
                  {canManage && <TableHead className="p-0 text-center" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 7 : 6}
                      className="h-32 text-center text-muted-foreground font-medium"
                    >
                      Data tidak ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((p, i) => (
                    <TableRow key={p.id} className="border-b border-border hover:bg-muted/20">
                      <TableCell className="border-r border-border text-center font-medium px-0.5 py-3">
                        {isSelectionMode ? (
                          <div className="flex justify-center">
                            <Checkbox
                              className="h-5 w-5"
                              checked={selectedIds.has(p.id)}
                              onCheckedChange={(checked) => {
                                const newSet = new Set(selectedIds);
                                if (checked) newSet.add(p.id);
                                else newSet.delete(p.id);
                                setSelectedIds(newSet);
                              }}
                            />
                          </div>
                        ) : (
                          (page - 1) * pageSize + i + 1
                        )}
                      </TableCell>
                      <TableCell className="border-r border-border font-mono text-xs font-semibold tracking-widest text-center py-3 px-2">
                        {p.kode}
                      </TableCell>
                      <TableCell className="border-r border-border font-medium text-center py-3 px-2">
                        {p.nama_puskesmas}
                      </TableCell>
                      <TableCell className="border-r border-border text-muted-foreground text-center py-3 px-2">
                        {p.kecamatan ?? "—"}
                      </TableCell>
                      <TableCell className="border-r border-border text-muted-foreground text-center py-3 px-2">
                        {p.kabupaten ?? "—"}
                      </TableCell>
                      <TableCell className="border-r border-border text-center py-3 px-2">
                        <StatusBadge status={p.status} />
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-center py-3 px-0">
                          <div className="inline-flex items-center justify-center gap-0">
                            <RowActionButton
                              label="Edit"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditing(p);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </RowActionButton>
                            <RowActionButton
                              label={p.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                              destructive={p.status === "aktif"}
                              className="h-7 w-7"
                              onClick={() => void toggleStatus(p)}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </RowActionButton>
                            <RowActionButton
                              label="Hapus Puskesmas"
                              destructive
                              className="h-7 w-7"
                              onClick={() => setDeleting(p)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </RowActionButton>
                          </div>
                        </TableCell>
                      )}
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

      <PuskesmasFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Hapus Puskesmas?"
        description={`Puskesmas ${deleting?.nama_puskesmas ?? ""} akan dihapus permanen. Penghapusan dibatalkan jika masih ada user yang terhubung.`}
        confirmLabel="Ya, Hapus"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
