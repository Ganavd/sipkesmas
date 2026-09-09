"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ClipboardList, Calendar, Trash2, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

import { kunjunganService } from "@/services/kunjungan.service";
import { keluargaService } from "@/services/keluarga.service";
import type { KeluargaWithRelations } from "@/modules/keluarga/types";
import type { KunjunganWithRelations } from "@/modules/kunjungan/types";
import { JENIS_KUNJUNGAN_LABEL, deriveStatusKunjungan } from "@/modules/kunjungan/types";
import { KunjunganStatusBadge } from "@/modules/kunjungan/components/kunjungan-status-badge";
import { KunjunganTindakanBadge } from "@/modules/kunjungan/components/kunjungan-tindakan-badge";
import { FamilySnapshotCard } from "@/modules/kunjungan/components/family-snapshot-card";
import { SuratIzinBox } from "@/modules/kunjungan/components/surat-izin-box";
import { formatTanggalWaktu } from "@/modules/kunjungan/utils/format";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";
import { ActivityTimeline, type TimelineItem } from "@/components/common/activity-timeline";
import { getKunjunganActivity } from "@/lib/kunjungan.functions";
import { attachmentService, type AttachmentRow } from "@/services/attachment.service";

interface Props {
  id: string;
}

export function KunjunganDetailView({ id }: Props) {
  const router = useRouter();
  const { role } = useAuth();

  const [kunjungan, setKunjungan] = useState<KunjunganWithRelations | null>(null);
  const [keluarga, setKeluarga] = useState<KeluargaWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<TimelineItem[]>([]);
  const [naskah, setNaskah] = useState<AttachmentRow | null>(null);
  const [activeTab, setActiveTab] = useState<"TL1" | "TL2">("TL1");
  const [isDeletingTL1, setIsDeletingTL1] = useState(false);
  const [isTLOpen, setIsTLOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const k = await kunjunganService.getById(id);
        setKunjungan(k);
        if (k) setKeluarga(await keluargaService.getById(k.keluarga_id));
        if (k) setNaskah(await attachmentService.getLatestForEntity("kunjungan", k.id));
        try {
          const res = await getKunjunganActivity({ kunjunganId: id, limit: 15 });
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
        toast.error(err instanceof Error ? err.message : "Gagal memuat kunjungan");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!kunjungan) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Kunjungan tidak ditemukan"
        description="Data mungkin telah dihapus atau Anda tidak memiliki akses."
        action={
          <Button asChild variant="outline">
            <Link href="/kunjungan/daftar">Kembali ke daftar</Link>
          </Button>
        }
      />
    );
  }

  const status = deriveStatusKunjungan(kunjungan);
  const isDraft = status === "draft";

  const showTindakLanjutAdmin =
    (role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS) &&
    status === "terdaftar" &&
    kunjungan.tindakan === "pengajuan";
  const showTindakLanjutPerawat =
    role === ROLES.PERAWAT &&
    status === "terdaftar" &&
    (kunjungan.tindakan === "disetujui" || kunjungan.tindakan === "proses");
  const showTindakLanjut = !isDraft && (showTindakLanjutAdmin || showTindakLanjutPerawat);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detail Kunjungan"
        breadcrumb={[
          { label: "Pendataan" },
          { label: "Daftar Kunjungan", href: "/kunjungan/daftar" },
          { label: "Lihat" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {showTindakLanjut && (
              <Button asChild size="sm">
                <a
                  href={`/kunjungan/${kunjungan.id}/tindak-lanjut-${showTindakLanjutAdmin ? "1" : "2"}`}
                >
                  Tindak Lanjut
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push("/kunjungan/daftar")}>
              Kembali
            </Button>
          </div>
        }
      />

      <Card className="shadow-sm">
        <CardContent className="space-y-6 p-6">
          <SuratIzinBox kunjunganId={kunjungan.id} />

          <div className="space-y-5 border-t border-border pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {/* Bagian Kiri: Judul & Tanggal */}
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {JENIS_KUNJUNGAN_LABEL[kunjungan.jenis_kunjungan]}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatTanggalWaktu(kunjungan.tanggal_kunjungan)}
                </p>
              </div>

              {/* Bagian Kanan: Kode Kunjungan + Badge Status */}
              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                <KunjunganTindakanBadge tindakan={kunjungan.tindakan} />
                <KunjunganStatusBadge status={status} />
                <span className="rounded border border-border bg-muted px-2.5 py-1 font-mono text-xs font-medium text-muted-foreground">
                  {kunjungan.kunjungan_code}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Petugas / Perawat" value={kunjungan.perawat_nama ?? "-"} />
              <Info label="Asal Puskesmas" value={kunjungan.puskesmas_nama ?? "-"} />
              <Info
                label="Tanggal & Jam Kunjungan"
                value={formatTanggalWaktu(kunjungan.tanggal_kunjungan)}
              />
              <Info label="Pembuatan Kunjungan" value={formatTanggalWaktu(kunjungan.created_at)} />
              <Info label="Perubahan Terakhir" value={formatTanggalWaktu(kunjungan.updated_at)} />
              <Info
                label="Status Terdaftar"
                value={
                  kunjungan.registered_at
                    ? formatTanggalWaktu(kunjungan.registered_at)
                    : "Belum diajukan resmi oleh keluarga"
                }
              />
            </div>

            {kunjungan.perihal && (
              <div className="rounded-lg bg-muted/30 p-4 border border-border/50">
                <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                  Perihal Kunjungan
                </p>
                <p className="mt-1.5 text-sm text-foreground leading-relaxed">
                  {kunjungan.perihal}
                </p>
              </div>
            )}
          </div>

          {!isDraft && (
            <div className="mt-8 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <button 
                onClick={() => setIsTLOpen(!isTLOpen)}
                className="flex w-full items-center justify-between bg-muted/30 px-6 py-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-foreground">Proses Tindak Lanjut</p>
                  {kunjungan.tindakan === "pengajuan" && (
                    <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500">
                      Menunggu
                    </span>
                  )}
                </div>
                {isTLOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </button>

              {isTLOpen && (
                <div className="p-6 space-y-8 border-t border-border bg-background/50">
                  {/* Pesan Status */}
                  {kunjungan.tindakan === "pengajuan" && (
                    <p className="text-sm text-center bg-muted/40 py-3 rounded-md border border-border/50 text-muted-foreground">
                      Menunggu Admin Puskesmas meninjau pengajuan dan mengisi Tim Kunjungan.
                    </p>
                  )}
                  {kunjungan.tindakan === "proses" && (
                    <p className="text-sm text-center bg-blue-50/50 dark:bg-blue-900/10 py-3 rounded-md border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400">
                      Kunjungan sedang diproses, menunggu Perawat Menindak Lanjuti.
                    </p>
                  )}
                  {kunjungan.tindakan === "selesai" && (
                    <p className="text-sm text-center bg-green-50/50 dark:bg-green-900/10 py-3 rounded-md border border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-400">
                      Tindakan kunjungan telah selesai. Lihat Daftar Asuhan Keperawatan.
                    </p>
                  )}

                  {/* Tabs Navigasi */}
                  <div className="flex items-center justify-center gap-8 border-b border-border">
                    <button
                      onClick={() => setActiveTab("TL1")}
                      className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
                        activeTab === "TL1"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Tindak Lanjut 1
                      <span className={`h-2.5 w-2.5 rounded-full ${(kunjungan.tl1_mobil || kunjungan.tl1_catatan || kunjungan.tl1_tim?.length) ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    </button>
                    <button
                      onClick={() => setActiveTab("TL2")}
                      className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
                        activeTab === "TL2"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Tindak Lanjut 2
                      <span className={`h-2.5 w-2.5 rounded-full ${kunjungan.tindakan === "selesai" ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    </button>
                  </div>

                  {/* Isi Tab */}
                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    {activeTab === "TL1" && (
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-border bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Tim Kunjungan</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Pilihan Kendaraan</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">File</th>
                            {(role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS) && (
                               <th className="px-4 py-3 font-medium text-muted-foreground text-center">Aksi</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {!(kunjungan.tl1_mobil || kunjungan.tl1_catatan || kunjungan.tl1_tim?.length) ? (
                            <tr>
                              <td colSpan={(role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS) ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">
                                Tindak Lanjut 1 Belum Dibuat.
                              </td>
                            </tr>
                          ) : (
                            <tr className="border-t border-border">
                              <td className="px-4 py-3 align-top whitespace-nowrap">
                                {formatTanggalWaktu(kunjungan.updated_at)}
                              </td>
                              <td className="px-4 py-3 align-top max-w-[200px] break-words">
                                {kunjungan.tl1_tim?.length ? (
                                  <ul className="list-disc list-inside space-y-1">
                                    {kunjungan.tl1_tim.map((t, i) => <li key={i}>{t}</li>)}
                                  </ul>
                                ) : "-"}
                              </td>
                              <td className="px-4 py-3 align-top">
                                {kunjungan.tl1_mobil?.length ? (
                                  <ul className="list-disc list-inside space-y-1">
                                    {kunjungan.tl1_mobil.map((m, i) => <li key={i}>{m}</li>)}
                                  </ul>
                                ) : "-"}
                              </td>
                              <td className="px-4 py-3 align-top">
                                {naskah ? (
                                  <a href={naskah.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                                    {naskah.name || "Lihat File"}
                                  </a>
                                ) : "-"}
                              </td>
                              {(role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS) && (
                                <td className="px-4 py-3 align-top text-center">
                                  <Button 
                                    variant="destructive" 
                                    size="icon" 
                                    disabled={isDeletingTL1}
                                    onClick={async () => {
                                      if(confirm("Apakah Anda yakin ingin menghapus Tindak Lanjut 1 dan mengembalikan status ke Pengajuan?")) {
                                        setIsDeletingTL1(true);
                                        try {
                                          const { revertTindakLanjut1 } = await import("@/lib/tindak-lanjut.functions");
                                          await revertTindakLanjut1(kunjungan.id);
                                          toast.success("Tindak Lanjut 1 berhasil dihapus");
                                          window.location.reload();
                                        } catch(e: any) {
                                          toast.error(e.message || "Gagal menghapus Tindak Lanjut 1");
                                        } finally {
                                          setIsDeletingTL1(false);
                                        }
                                      }
                                    }}
                                    className="h-8 w-8"
                                    title="Hapus Permanent"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}

                    {activeTab === "TL2" && (
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-border bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 font-medium text-muted-foreground w-1/4">Tanggal</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kunjungan.tindakan !== "selesai" ? (
                            <tr>
                              <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                                Tindak Lanjut 2 Belum Dibuat.
                              </td>
                            </tr>
                          ) : (
                            <tr>
                              <td className="px-4 py-4 align-top whitespace-nowrap border-t border-border">
                                {formatTanggalWaktu(kunjungan.updated_at)}
                              </td>
                              <td className="px-4 py-4 align-top border-t border-border font-medium text-foreground">
                                Asuhan Keperawatan Sudah Dibuat, Periksa Di Menu Daftar Asuhan Keperawatan.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-12">
        <FamilySnapshotCard keluarga={keluarga} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/20 p-3 border border-border/40">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
