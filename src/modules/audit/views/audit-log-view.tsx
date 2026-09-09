import { useEffect, useState } from "react";
import { History, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonRows } from "@/components/common/skeleton-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { auditService, type AuditLogRow } from "@/services/audit.service";

const ACTION_LABELS: Record<string, string> = {
  reset_password: "Reset Kata Sandi",
  activate_user: "Aktifkan Pengguna",
  deactivate_user: "Nonaktifkan Pengguna",
  update_user: "Perbarui Pengguna",
  create_user: "Buat Pengguna",
  create_puskesmas: "Buat Puskesmas",
  update_puskesmas: "Perbarui Puskesmas",
  delete_puskesmas: "Hapus Puskesmas",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function AuditLogView() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setRows(await auditService.list(200));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memuat catatan aktivitas");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catatan Aktivitas"
        description="Riwayat aksi pada sistem untuk keperluan audit dan akuntabilitas."
      />
      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={History}
              title="Belum ada aktivitas"
              description="Catatan aktivitas akan muncul setelah ada aksi penting pada sistem."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Entitas</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(r.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                      <ShieldAlert className="h-3 w-3" />
                      {ACTION_LABELS[r.action] ?? r.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">{r.entity}</TableCell>
                  <TableCell>{r.description ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
