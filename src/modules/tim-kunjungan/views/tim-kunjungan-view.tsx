"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Users as UsersIcon, Search, Pencil, UserCheck, UserX, Eye } from "lucide-react";
import { toast } from "sonner";
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
import { timKunjunganService, type TimKunjunganRow } from "@/services/tim-kunjungan.service";
import { useAuth } from "@/hooks/use-auth";
import { FormTimModal } from "@/modules/tim-kunjungan/components/form-tim-modal";

export function TimKunjunganView() {
  const { role } = useAuth();
  const [items, setItems] = useState<TimKunjunganRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "view">("add");
  const [selectedTarget, setSelectedTarget] = useState<TimKunjunganRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await timKunjunganService.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat data tim kunjungan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((u) => {
      if (!q) return true;
      return [u.user_name, u.user_email]
        .filter((v): v is string => !!v)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [items, search]);

  const handleAdd = () => {
    setModalMode("add");
    setSelectedTarget(null);
    setModalOpen(true);
  };

  const handleEdit = (item: TimKunjunganRow) => {
    setModalMode("edit");
    setSelectedTarget(item);
    setModalOpen(true);
  };

  const handleView = (item: TimKunjunganRow) => {
    setModalMode("view");
    setSelectedTarget(item);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tim Kunjungan"
        description="Master data anggota tim yang akan ditugaskan pada Tindak Lanjut Kunjungan."
        actions={
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Tim
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-4">
            <SkeletonRows rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={UsersIcon}
              title={items.length === 0 ? "Belum ada tim kunjungan" : "Tidak ada hasil"}
              description={
                items.length === 0
                  ? "Tambahkan tim kunjungan pertama melalui tombol di kanan atas."
                  : "Coba ubah kata kunci pencarian."
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item, i) => (
                <TableRow key={item.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    {item.user_name || "—"}
                    <div className="text-xs text-muted-foreground font-normal">
                      {item.user_email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status_aktif ? "aktif" : "nonaktif"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <RowActionButton label="Lihat Detail" onClick={() => handleView(item)}>
                        <Eye className="h-4 w-4" />
                      </RowActionButton>
                      <RowActionButton label="Edit" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </RowActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <FormTimModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        initialData={selectedTarget}
        onSaved={load}
      />
    </div>
  );
}
