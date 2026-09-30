import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, ClipboardList, HeartPulse, Activity, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/modules/dashboard/components/stat-card";
import { KunjunganPieChart } from "@/modules/dashboard/components/kunjungan-pie-chart";
import { ROLES, ROLE_LABELS, type AppRole } from "@/lib/constants/roles";
import { getDashboardStats, getDashboardActivity } from "@/lib/dashboard.functions";
import { ActivityTimeline, type TimelineItem } from "@/components/common/activity-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowStatusBadge } from "@/components/common/workflow-status-badge";
import { formatTanggalWaktu, waktuRelatif } from "@/modules/kunjungan/utils/format";
import {
  STATUS_KUNJUNGAN_LABEL,
  JENIS_KUNJUNGAN_LABEL,
  deriveStatusKunjungan,
} from "@/modules/kunjungan/types";

type Stats = Awaited<ReturnType<typeof getDashboardStats>>;
type ActivityData = Awaited<ReturnType<typeof getDashboardActivity>>;

const TITLES: Record<AppRole, { title: string; desc: string }> = {
  [ROLES.ADMIN_DINKES]: {
    title: "Dashboard Dinas Kesehatan",
    desc: "Ringkasan operasional seluruh Puskesmas.",
  },
  [ROLES.ADMIN_PUSKESMAS]: {
    title: "Dashboard Admin Puskesmas",
    desc: "Operasional Puskesmas Anda.",
  },
  [ROLES.PERAWAT]: { title: "Dashboard Perawat", desc: "Jadwal dan kunjungan Anda." },
  [ROLES.KELUARGA]: { title: "Dashboard Keluarga", desc: "Pantau status kesehatan keluarga Anda." },
};

export function RoleDashboard({ role }: { role: AppRole }) {
  const cfg = TITLES[role];
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartFiltering, setChartFiltering] = useState(false);

  useEffect(() => {
    let live = true;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const s = await getDashboardStats();
        if (!cancelled && live) setStats(s);

        const a = await getDashboardActivity();
        if (!cancelled && live) setActivity(a);
      } catch {
        // Keep the dashboard shell visible instead of turning the whole page blank.
      } finally {
        if (!cancelled && live) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      live = false;
    };
  }, []);

  const handleDateRangeChange = async (range: { from?: Date; to?: Date } | undefined) => {
    setChartFiltering(true);
    try {
      const s = await getDashboardStats(
        range?.from
          ? {
              startDate: range.from.toISOString(),
              endDate: (range.to || range.from).toISOString(),
            }
          : undefined
      );
      setStats(s);
    } catch {
      // keep previous stats if error
    } finally {
      setChartFiltering(false);
    }
  };

  const cards = buildCards(stats);
  const timelineItems: TimelineItem[] = (activity?.auditLogs ?? []).map((l) => ({
    id: l.id,
    action: l.action,
    entity: l.entity,
    description: l.description,
    created_at: l.created_at,
    actor_name: l.actor_name,
    actor_role: l.actor_role,
  }));

  return (
    <div className="space-y-8">
      <PageHeader title={cfg.title} description={cfg.desc} />

      <section aria-label="Ringkasan" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : cards.map((c) => <StatCard key={c.label} {...c} />)}
      </section>

      {role === ROLES.KELUARGA ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Kunjungan Terbaru Anda</h3>
              <Link href="/kunjungan/daftar" className="text-xs text-primary hover:underline">
                Lihat semua
              </Link>
            </div>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (activity?.kunjunganTerbaru?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Belum ada pengajuan kunjungan tercatat.
              </p>
            ) : (
              <ul className="space-y-3">
                {activity!.kunjunganTerbaru.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-2.5 last:border-0 last:pb-0"
                  >
                    <Link href={`/kunjungan/${k.id}`} className="min-w-0 flex-1 hover:text-primary">
                      <p className="truncate font-medium">{k.keluarga_nama ?? "Keluarga Anda"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {
                          JENIS_KUNJUNGAN_LABEL[
                            k.jenis_kunjungan as keyof typeof JENIS_KUNJUNGAN_LABEL
                          ]
                        }{" "}
                        · {STATUS_KUNJUNGAN_LABEL[deriveStatusKunjungan(k)]} ·{" "}
                        {formatTanggalWaktu(k.tanggal_kunjungan)}
                      </p>
                    </Link>
                    <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {k.kunjungan_code}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Informasi Keluarga Binaan</h3>
              <span className="text-xs font-medium text-muted-foreground">Status Terdaftar</span>
            </div>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-3">
                {(activity?.keluargaTerbaru?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Data profil keluarga belum terhubung.
                  </p>
                ) : (
                  activity!.keluargaTerbaru.slice(0, 3).map((kel) => (
                    <div
                      key={kel.id}
                      className="rounded-lg bg-muted/30 p-3 text-sm border border-border/40"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground">{kel.kepala_keluarga}</p>
                        <WorkflowStatusBadge entity={{ is_registered: kel.is_registered }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Kode Keluarga: <span className="font-mono">{kel.keluarga_code}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Kunjungan Terbaru</h3>
              <Link href="/kunjungan/daftar" className="text-xs text-primary hover:underline">
                Lihat semua
              </Link>
            </div>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (activity?.kunjunganTerbaru?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada kunjungan tercatat.</p>
            ) : (
              <ul className="space-y-3">
                {activity!.kunjunganTerbaru.map((k) => (
                  <li key={k.id} className="flex items-start justify-between gap-3 text-sm">
                    <Link href={`/kunjungan/${k.id}`} className="min-w-0 flex-1 hover:text-primary">
                      <p className="truncate font-medium">{k.keluarga_nama ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {
                          JENIS_KUNJUNGAN_LABEL[
                            k.jenis_kunjungan as keyof typeof JENIS_KUNJUNGAN_LABEL
                          ]
                        }{" "}
                        · {STATUS_KUNJUNGAN_LABEL[deriveStatusKunjungan(k)]} ·{" "}
                        {formatTanggalWaktu(k.tanggal_kunjungan)}
                      </p>
                    </Link>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {k.kunjungan_code}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Keluarga Terbaru</h3>
              <Link href="/keluarga/log" className="text-xs text-primary hover:underline">
                Lihat semua
              </Link>
            </div>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (activity?.keluargaTerbaru?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada keluarga didata.</p>
            ) : (
              <ul className="space-y-3">
                {activity!.keluargaTerbaru.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link href={`/keluarga/${k.id}`} className="min-w-0 flex-1 hover:text-primary">
                      <p className="truncate font-medium">{k.kepala_keluarga}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {k.keluarga_code} · {waktuRelatif(k.created_at)}
                      </p>
                    </Link>
                    <WorkflowStatusBadge entity={{ is_registered: k.is_registered }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section aria-label="Aktivitas" className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Aktivitas Terbaru</h3>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ActivityTimeline items={timelineItems} />
        )}
      </section>

      {/* Bagian Grafik Diagram Pie Distribusi Kunjungan (Paling Bawah) */}
      <section aria-label="Grafik Distribusi Kunjungan" className="w-full">
        {loading ? (
          <Skeleton className="h-[380px] w-full rounded-xl" />
        ) : (
          <KunjunganPieChart
            role={role}
            totalKunjungan={stats?.totalKunjungan ?? 0}
            belumKonfirmasiKeluarga={stats?.belumKonfirmasiKeluarga ?? 0}
            belumKonfirmasiKapus={stats?.belumKonfirmasiKapus ?? 0}
            sedangDiproses={stats?.sedangDiproses ?? 0}
            sudahSelesai={stats?.sudahSelesai ?? 0}
            isLoading={chartFiltering}
            onDateRangeChange={handleDateRangeChange}
          />
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Anda masuk sebagai <span className="font-medium text-foreground">{ROLE_LABELS[role]}</span>.
      </p>
    </div>
  );
}

function buildCards(stats: Stats | null) {
  if (!stats) return [];
  const f = (n: number | undefined) => (n ?? 0).toLocaleString("id-ID");
  if (stats.scope === "dinkes") {
    return [
      { label: "Total Puskesmas", value: f(stats.totalPuskesmas), icon: Building2 },
      { label: "Total Pengguna", value: f(stats.totalPengguna), icon: Users },
      { label: "Total Keluarga", value: f(stats.totalKeluarga), icon: HeartPulse },
      { label: "User Aktif Hari Ini", value: f(stats.userAktifHariIni), icon: Activity },
      {
        label: "Registered Hari Ini",
        value: f(stats.registeredHariIni),
        icon: CheckCircle2,
        hint: "Keluarga + kunjungan",
      },
      {
        label: "Draft Pending",
        value: f(stats.draftPending),
        icon: Activity,
        hint: "Pengajuan belum masuk TL1",
      },
    ];
  }
  if (stats.scope === "puskesmas") {
    return [
      { label: "Keluarga Binaan", value: f(stats.totalKeluarga), icon: HeartPulse },
      { label: "Perawat", value: f(stats.totalPerawat), icon: Users },
      {
        label: "Draft Pending",
        value: f(stats.draftPending),
        icon: Activity,
        hint: "Kunjungan belum diproses",
      },
      { label: "User Aktif Hari Ini", value: f(stats.userAktifHariIni), icon: Activity },
      {
        label: "Registered Hari Ini",
        value: f(stats.registeredHariIni),
        icon: CheckCircle2,
        hint: "Keluarga + kunjungan",
      },
    ];
  }
  return [
    {
      label: "Keluarga Binaan",
      value: f(stats.totalKeluarga),
      icon: HeartPulse,
      hint: "Data keluarga aktif",
    },
  ];
}
