import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Users as UsersIcon,
  AlertCircle,
  Search,
  KeyRound,
  Pencil,
  UserCheck,
  UserX,
  Trash2,
  Printer,
} from "lucide-react";
import Link from "next/link";
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
import { RoleBadge } from "@/components/common/role-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RowActionButton } from "@/components/common/row-action-button";
import { usersService, type UserRow } from "@/services/users.service";
import { CreateUserDialog } from "@/modules/users/components/create-user-dialog";
import { EditUserDialog } from "@/modules/users/components/edit-user-dialog";
import { ResetPasswordDialog } from "@/modules/users/components/reset-password-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useGovernance } from "@/hooks/use-governance";
import { ROLES, ROLE_LABELS, type AppRole } from "@/lib/constants/roles";
import { toggleUserActive, deleteUser } from "@/lib/users.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { usePrintHeader } from "@/hooks/use-print-header";

type RoleFilter = "all" | AppRole;

export function UsersView() {
  const { role, user, profile } = useAuth();
  const governance = useGovernance();
  const { printHeader, getPrintFilename } = usePrintHeader();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal targets
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [toggleTarget, setToggleTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  // Table UI State
  const [namaFilter, setNamaFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [puskesmasFilter, setPuskesmasFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "aktif" | "nonaktif">("all");

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSizeInput, setPageSizeInput] = useState("10");
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await usersService.list({
        callerRole: role,
        callerPuskesmasId: profile?.puskesmas_id ?? null,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (u.role === "keluarga") return false; // Sembunyikan user keluarga
      if (user?.id && u.id === user.id) return false; // Sembunyikan akun sendiri
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "aktif" && !u.is_active) return false;
        if (statusFilter === "nonaktif" && u.is_active) return false;
      }
      if (namaFilter && !(u.full_name ?? "").toLowerCase().includes(namaFilter.toLowerCase()))
        return false;
      if (
        usernameFilter &&
        !(u.username ?? "").toLowerCase().includes(usernameFilter.toLowerCase())
      )
        return false;
      if (
        puskesmasFilter &&
        !(u.puskesmas_nama ?? "").toLowerCase().includes(puskesmasFilter.toLowerCase())
      )
        return false;
      return true;
    });
  }, [users, roleFilter, statusFilter, namaFilter, usernameFilter, puskesmasFilter, user?.id]);

  const pageSize = limit > 0 ? limit : Math.max(1, filtered.length);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (!role) return null;
  const isDinkes = role === ROLES.ADMIN_DINKES;
  const blocked = isDinkes && !governance.loading && !governance.hasPuskesmas;

  const handleToggleActive = async (u: UserRow) => {
    try {
      await toggleUserActive({ user_id: u.id, is_active: !u.is_active });
      toast.success(u.is_active ? "Pengguna dinonaktifkan" : "Pengguna diaktifkan");
      setToggleTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  };

  const handleDeleteUser = async (u: UserRow) => {
    try {
      await deleteUser({ user_id: u.id });
      toast.success("Pengguna berhasil dihapus");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pengguna");
    }
  };

  const selectedUsers = users.filter((u) => selectedIds.has(u.id));

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
    document.title = getPrintFilename("Daftar Manajemen User");
    setIsPrinting(true);
    window.setTimeout(() => {
      window.print();
      document.title = prev;
    }, 80);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen User"
        description="Kelola pengguna sistem berdasarkan peran dan Puskesmas."
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={blocked}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Pengguna
          </Button>
        }
      />

      {blocked && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-soft bg-warning-soft/40 p-4 mb-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Silakan daftarkan data Puskesmas terlebih dahulu sebelum membuat pengguna.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Manajemen pengguna terkunci hingga minimal satu Puskesmas tersedia.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/puskesmas">Buka Modul Puskesmas</Link>
            </Button>
          </div>
        </div>
      )}

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
              </>
            )}
          </div>

          {/* Baris 2: Limit (Hijau) */}
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
              <SkeletonRows rows={6} />
            </div>
          ) : users.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={UsersIcon}
                title="Belum ada pengguna"
                description="Tambahkan pengguna pertama melalui tombol di atas."
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
                    Nama
                  </TableHead>
                  <TableHead className="w-[15%] border-r border-border text-center font-bold py-3">
                    Username
                  </TableHead>
                  <TableHead className="w-[15%] border-r border-border text-center font-bold py-3">
                    Peran
                  </TableHead>
                  <TableHead className="w-[15%] border-r border-border text-center font-bold py-3">
                    Puskesmas
                  </TableHead>
                  <TableHead className="w-[10%] border-r border-border text-center font-bold py-3">
                    Status
                  </TableHead>
                  <TableHead className="w-32 text-center font-bold px-0.5 py-3">Aksi</TableHead>
                </TableRow>
                <TableRow className="border-b border-border bg-background hover:bg-transparent">
                  <TableHead className="border-r border-border p-1 text-center" />
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={namaFilter}
                      onChange={(e) => setNamaFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={usernameFilter}
                      onChange={(e) => setUsernameFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Select
                      value={roleFilter}
                      onValueChange={(v) => setRoleFilter(v as RoleFilter)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Peran" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua</SelectItem>
                        {(Object.keys(ROLE_LABELS) as AppRole[])
                          .filter((r) => r !== "keluarga")
                          .map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Input
                      value={puskesmasFilter}
                      onChange={(e) => setPuskesmasFilter(e.target.value)}
                      className="h-8 text-xs text-center"
                    />
                  </TableHead>
                  <TableHead className="border-r border-border p-1.5">
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
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
                      colSpan={7}
                      className="h-32 text-center text-muted-foreground font-medium"
                    >
                      Data tidak ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((u, i) => (
                    <TableRow key={u.id} className="border-b border-border hover:bg-muted/20">
                      <TableCell className="border-r border-border text-center font-medium px-0.5 py-3">
                        {isSelectionMode ? (
                          <div className="flex justify-center">
                            <Checkbox
                              className="h-5 w-5"
                              checked={selectedIds.has(u.id)}
                              onCheckedChange={(checked) => {
                                const newSet = new Set(selectedIds);
                                if (checked) newSet.add(u.id);
                                else newSet.delete(u.id);
                                setSelectedIds(newSet);
                              }}
                            />
                          </div>
                        ) : (
                          (page - 1) * pageSize + i + 1
                        )}
                      </TableCell>
                      <TableCell className="border-r border-border font-medium text-center py-3 px-2">
                        {u.full_name || "—"}
                      </TableCell>
                      <TableCell className="border-r border-border text-muted-foreground text-center py-3 px-2">
                        {u.username ?? "—"}
                      </TableCell>
                      <TableCell className="border-r border-border text-center py-3 px-2">
                        {u.role ? <RoleBadge role={u.role} /> : "—"}
                      </TableCell>
                      <TableCell className="border-r border-border text-muted-foreground text-center py-3 px-2">
                        {u.puskesmas_nama ?? "—"}
                      </TableCell>
                      <TableCell className="border-r border-border text-center py-3 px-2">
                        <StatusBadge status={u.is_active ? "aktif" : "nonaktif"} />
                      </TableCell>
                      <TableCell className="text-center py-3 px-1">
                        <div className="inline-flex items-center justify-center gap-1.5 flex-wrap">
                          <RowActionButton label="Edit" onClick={() => setEditTarget(u)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </RowActionButton>
                          <RowActionButton
                            label="Reset kata sandi"
                            onClick={() => setResetTarget(u)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </RowActionButton>
                          <RowActionButton
                            label={u.is_active ? "Nonaktifkan" : "Aktifkan"}
                            destructive={u.is_active}
                            onClick={() => setToggleTarget(u)}
                          >
                            {u.is_active ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )}
                          </RowActionButton>
                          <RowActionButton
                            label="Hapus"
                            destructive
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </RowActionButton>
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

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        currentRole={role}
        onCreated={load}
      />

      {editTarget && (
        <EditUserDialog
          open={!!editTarget}
          onOpenChange={(o) => {
            if (!o) setEditTarget(null);
          }}
          user={editTarget}
          currentRole={role}
          onSaved={load}
        />
      )}

      {resetTarget && (
        <ResetPasswordDialog
          open={!!resetTarget}
          onOpenChange={(o) => {
            if (!o) setResetTarget(null);
          }}
          userId={resetTarget.id}
          userLabel={resetTarget.full_name || resetTarget.username || "pengguna"}
        />
      )}

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(o) => {
          if (!o) setToggleTarget(null);
        }}
        title={toggleTarget?.is_active ? "Nonaktifkan pengguna?" : "Aktifkan pengguna?"}
        description={
          toggleTarget
            ? toggleTarget.is_active
              ? `${toggleTarget.full_name ?? toggleTarget.username} tidak akan dapat login hingga diaktifkan kembali.`
              : `${toggleTarget.full_name ?? toggleTarget.username} akan dapat login kembali ke sistem.`
            : undefined
        }
        confirmLabel={toggleTarget?.is_active ? "Nonaktifkan" : "Aktifkan"}
        destructive={toggleTarget?.is_active ?? false}
        onConfirm={() => {
          if (toggleTarget) void handleToggleActive(toggleTarget);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title="Hapus pengguna?"
        description={
          deleteTarget
            ? `Pengguna ${deleteTarget.full_name || deleteTarget.username} akan dihapus secara permanen dari sistem.`
            : ""
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={() => {
          if (deleteTarget) void handleDeleteUser(deleteTarget);
        }}
      />

      {/* Print Section — hanya terlihat saat window.print() */}
      {isPrinting && (
        <div className="askep-print-only">
          <section className="bg-white text-black px-8 py-6">
            <div className="mb-5 text-center">
              <div className="text-sm font-bold uppercase">DAFTAR MANAJEMEN USER</div>
              <div className="text-[11px] font-medium uppercase mt-0.5">{printHeader}</div>
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="w-8 border border-black px-1.5 py-1">No</th>
                  <th className="border border-black px-1.5 py-1">Nama Lengkap</th>
                  <th className="border border-black px-1.5 py-1">Username</th>
                  <th className="border border-black px-1.5 py-1">Peran</th>
                  <th className="border border-black px-1.5 py-1">Puskesmas</th>
                  <th className="border border-black px-1.5 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedUsers.map((u, index) => (
                  <tr key={u.id}>
                    <td className="border border-black px-1.5 py-1 text-center">{index + 1}</td>
                    <td className="border border-black px-1.5 py-1">{u.full_name || "-"}</td>
                    <td className="border border-black px-1.5 py-1">{u.username ?? "-"}</td>
                    <td className="border border-black px-1.5 py-1">
                      {u.role ? ROLE_LABELS[u.role] : "-"}
                    </td>
                    <td className="border border-black px-1.5 py-1">{u.puskesmas_nama ?? "-"}</td>
                    <td className="border border-black px-1.5 py-1 text-center">
                      {u.is_active ? "Aktif" : "Nonaktif"}
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
