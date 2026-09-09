import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Phone,
  MapPin,
  Hash,
  IdCard,
  Calendar,
  Users,
  Activity,
  HeartPulse,
  ClipboardList,
  Edit,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { KeyRound } from "lucide-react";

import { keluargaService } from "@/services/keluarga.service";
import { kunjunganService } from "@/services/kunjungan.service";
import type { AnggotaKeluargaRow, KeluargaWithRelations } from "@/modules/keluarga/types";
import { AnggotaFormDialog } from "@/modules/keluarga/components/anggota-form-dialog";
import { KeluargaStatusBadge } from "@/modules/keluarga/components/keluarga-status-badge";
import { hitungUmur, formatTanggal } from "@/modules/keluarga/utils/format";
import { deleteAnggota, getKeluargaActivity } from "@/lib/keluarga.functions";
import { ActivityTimeline, type TimelineItem } from "@/components/common/activity-timeline";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";
import { WorkflowStatusBadge } from "@/components/common/workflow-status-badge";
import { WorkflowActionBar } from "@/components/common/workflow-action-bar";
import { registerEntity, overrideRegisteredEntity } from "@/lib/workflow.functions";
import { RegisteredBanner } from "@/components/common/registered-banner";
import { deriveWorkflowState } from "@/lib/workflow-state";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  keluargaId: string;
}

export function KeluargaDetailView({ keluargaId }: Props) {
  const router = useRouter();
  const { role } = useAuth();
  const [keluarga, setKeluarga] = useState<KeluargaWithRelations | null>(null);
  const [authProfile, setAuthProfile] = useState<{
    email: string | null;
    username: string | null;
    role: string | null;
    is_active: boolean;
  } | null>(null);
  const [anggota, setAnggota] = useState<AnggotaKeluargaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AnggotaKeluargaRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnggotaKeluargaRow | null>(null);
  const [activity, setActivity] = useState<TimelineItem[]>([]);
  const [kunjunganStats, setKunjunganStats] = useState({ total: 0, lastDate: "" });
  const [creatorName, setCreatorName] = useState<string>("-");

  const canMutate =
    role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS || role === ROLES.PERAWAT;
  const canRegister =
    role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS || role === ROLES.PERAWAT;
  const canOverride = role === ROLES.ADMIN_DINKES;
  const [wfBusy, setWfBusy] = useState(false);

  const onRegister = async (note: string) => {
    if (!keluarga) return;
    setWfBusy(true);
    try {
      await registerEntity({ entity: "keluarga", id: keluarga.id, note });
      toast.success("Keluarga didaftarkan ke daftar resmi.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mendaftarkan");
    } finally {
      setWfBusy(false);
    }
  };

  const onOverride = async (note: string) => {
    if (!keluarga) return;
    setWfBusy(true);
    try {
      await overrideRegisteredEntity({ entity: "keluarga", id: keluarga.id, note, patch: {} });
      toast.success("Catatan override tersimpan.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal override");
    } finally {
      setWfBusy(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [k, a, kunjungans] = await Promise.all([
        keluargaService.getById(keluargaId),
        keluargaService.listAnggota(keluargaId),
        kunjunganService.listByKeluargaId(keluargaId),
      ]);
      setKeluarga(k);
      setAnggota(a);

      if (k?.user_id) {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: prof } = await supabase
          .from("profiles")
          .select("email, username, role, is_active")
          .eq("id", k.user_id)
          .maybeSingle();
        setAuthProfile(prof as any);
      } else {
        setAuthProfile(null);
      }

      if (kunjungans && kunjungans.length > 0) {
        setKunjunganStats({
          total: kunjungans.length,
          lastDate: kunjungans[0].tanggal_kunjungan,
        });
      } else {
        setKunjunganStats({ total: 0, lastDate: "" });
      }

      try {
        // Fetch more to potentially find the creator, but only show today's activity
        const res = await getKeluargaActivity({ keluargaId, limit: 50 });

        // Find creator (first 'create' action)
        const createAction = [...res.items].reverse().find((x) => x.action === "create");
        if (createAction) {
          setCreatorName(createAction.actor_name || "-");
        }

        // Filter to only today's activity for the timeline
        const today = new Date().toISOString().split("T")[0];
        const todayActivities = res.items.filter((x) => x.created_at.startsWith(today));

        setActivity(
          todayActivities.map((x) => ({
            id: x.id,
            action: x.action,
            entity: x.entity,
            description: x.description,
            created_at: x.created_at,
            actor_name: x.actor_name,
            actor_role: x.actor_role,
          })),
        );
      } catch {
        setActivity([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat keluarga");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [keluargaId]);

  const confirmDeleteAnggota = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAnggota({ id: deleteTarget.id });
      toast.success("Anggota keluarga dihapus");
      setDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus anggota");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!keluarga) {
    return (
      <EmptyState
        icon={HeartPulse}
        title="Keluarga tidak ditemukan"
        description="Data mungkin telah dihapus atau Anda tidak memiliki akses."
        action={
          <Button asChild variant="outline">
            <Link href="/keluarga/daftar">Kembali ke daftar</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          Kembali
        </Button>
      </div>

      {/* Kartu Keluarga Digital */}
      <Card className="overflow-hidden border-border bg-gradient-to-br from-primary-soft/40 to-card">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-block rounded-md bg-primary px-2 py-0.5 text-xs font-semibold tracking-wide text-primary-foreground">
                  KARTU KELUARGA DIGITAL
                </span>
                <h2 className="text-2xl font-semibold text-foreground">
                  {keluarga.kepala_keluarga}
                </h2>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <KeluargaStatusBadge status={keluarga.status} isDeleted={!!keluarga.deleted_at} />
                <div className="rounded border border-border bg-background/50 px-3 py-1 font-mono text-sm text-foreground">
                  {keluarga.keluarga_code}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem icon={Hash} label="Nomor KK" value={keluarga.nomor_kk} mono />
              <InfoItem icon={IdCard} label="NIK Kepala Keluarga" value={keluarga.nik} mono />
              <InfoItem icon={Phone} label="Telepon" value={keluarga.telepon ?? "-"} />
              <InfoItem icon={MapPin} label="Alamat" value={keluarga.alamat ?? "-"} />
              <InfoItem
                icon={Users}
                label="Jumlah Anggota"
                value={`${keluarga.anggota_count} orang`}
              />
              <InfoItem icon={Activity} label="Puskesmas" value={keluarga.puskesmas_nama ?? "-"} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata operasional */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h4 className="mb-3 text-sm font-semibold text-foreground">Metadata Operasional</h4>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Meta label="Ditambahkan oleh" value={creatorName} />
          <Meta label="Dibuat pada" value={formatTanggal(keluarga.created_at)} />
          <Meta label="Diperbarui" value={formatTanggal(keluarga.updated_at)} />
        </div>
      </div>

      {/* Anggota Keluarga */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Anggota Keluarga</h3>
            <p className="text-xs text-muted-foreground">
              Daftar anggota yang terdaftar dalam Kartu Keluarga.
            </p>
          </div>
          {canMutate && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Anggota
            </Button>
          )}
        </div>
        {anggota.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="Belum ada anggota keluarga"
              description="Tambahkan anggota keluarga untuk melengkapi data Kartu Keluarga."
              action={
                canMutate ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditTarget(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Tambah Anggota
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Hubungan</TableHead>
                <TableHead>NIK</TableHead>
                <TableHead>Tanggal Lahir</TableHead>
                <TableHead>Umur</TableHead>
                <TableHead>L/P</TableHead>
                {canMutate && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {anggota.map((a) => {
                const umur = hitungUmur(a.tanggal_lahir);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nama}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.hubungan}</TableCell>
                    <TableCell className="font-mono text-xs">{a.nik ?? "-"}</TableCell>
                    <TableCell className="text-sm">{formatTanggal(a.tanggal_lahir)}</TableCell>
                    <TableCell className="text-sm">{umur !== null ? `${umur} thn` : "-"}</TableCell>
                    <TableCell className="text-sm">
                      {a.jenis_kelamin === "L"
                        ? "Laki-laki"
                        : a.jenis_kelamin === "P"
                          ? "Perempuan"
                          : "-"}
                    </TableCell>
                    {canMutate && (
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary"
                            onClick={() => {
                              setEditTarget(a);
                              setFormOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteTarget(a)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Auth Info */}
      <div className="lg:col-span-3">
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Informasi Akun Login</h3>
            </div>

            {!authProfile ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Tidak ada informasi akun untuk keluarga ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Username</span>
                  <p className="text-sm font-medium text-foreground">
                    {authProfile.username || "-"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Email</span>
                  <p className="text-sm font-medium text-foreground">{authProfile.email || "-"}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                  <div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${authProfile.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {authProfile.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 flex items-center justify-end">
                  {canMutate && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/keluarga/${keluarga.id}/edit`}>
                        <Edit className="w-4 h-4 mr-2" />
                        Ubah Password
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistik Kunjungan */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h4 className="mb-3 text-sm font-semibold text-foreground">Statistik Kunjungan</h4>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Meta label="Total Kunjungan Keluarga" value={`${kunjunganStats.total} Kunjungan`} />
          <Meta
            label="Kunjungan Terakhir"
            value={kunjunganStats.lastDate ? formatTanggal(kunjunganStats.lastDate) : "-"}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">Aktivitas Hari Ini</h4>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada aktivitas hari ini.</p>
        ) : (
          <ActivityTimeline items={activity} />
        )}
      </div>

      <AnggotaFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditTarget(null);
        }}
        keluargaId={keluarga.id}
        initial={editTarget}
        onSaved={() => void load()}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Hapus anggota keluarga?"
        description={`Data anggota "${deleteTarget?.nama ?? ""}" akan dihapus. Riwayat tetap tersimpan dan dapat dipulihkan oleh administrator.`}
        confirmLabel="Ya, Hapus"
        destructive
        onConfirm={confirmDeleteAnggota}
      />
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={mono ? "font-mono text-sm text-foreground" : "text-sm text-foreground"}>
          {value}
        </p>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
