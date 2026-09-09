"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Send, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SuratIzinBox } from "@/modules/kunjungan/components/surat-izin-box";
import { KunjunganStatusBadge } from "@/modules/kunjungan/components/kunjungan-status-badge";
import { KunjunganTindakanBadge } from "@/modules/kunjungan/components/kunjungan-tindakan-badge";

import { kunjunganService } from "@/services/kunjungan.service";
import { JENIS_KUNJUNGAN_LABEL, deriveStatusKunjungan, type KunjunganWithRelations } from "@/modules/kunjungan/types";
import { formatTanggalWaktu } from "@/modules/kunjungan/utils/format";
import { ajukanPerubahanJadwal } from "@/lib/kunjungan.functions";
import { ajukanResmiKunjungan } from "@/lib/workflow.functions";

interface Props {
  id: string;
}

export function KeluargaKunjunganDetailView({ id }: Props) {
  const [data, setData] = useState<KunjunganWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUbahJadwal, setShowUbahJadwal] = useState(false);
  const [tanggalBaru, setTanggalBaru] = useState("");
  const [jamBaru, setJamBaru] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmResmi, setConfirmResmi] = useState(false);

  const load = () => {
    setLoading(true);
    kunjunganService.getById(id).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Memuat detail kunjungan...</div>;
  }
  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Kunjungan tidak ditemukan.</div>;
  }

  const status = deriveStatusKunjungan(data);
  const tindakan = data.tindakan?.toLowerCase();

  // Status Draft murni (sebelum terdaftar resmi)
  const isDraft = status === "draft" || tindakan === "draft";
  const isPengajuan = tindakan === "pengajuan";
  const isProsesOrDisetujui = tindakan === "proses" || tindakan === "disetujui";
  const isSelesai = tindakan === "selesai" || status?.toLowerCase() === "selesai";

  const hasInputBaru = !!tanggalBaru || !!jamBaru;

  const clearBoxUbahJadwal = () => {
    setTanggalBaru("");
    setJamBaru("");
    setShowUbahJadwal(false);
  };

  const submitUbahJadwal = async () => {
    if (!tanggalBaru || !jamBaru) {
      toast.error("Lengkapi tanggal dan jam baru");
      return;
    }
    setSaving(true);
    try {
      await ajukanPerubahanJadwal({ id, tanggalBaru: `${tanggalBaru}T${jamBaru}:00` });
      toast.success("Jadwal perubahan berhasil dikirim");
      clearBoxUbahJadwal();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui jadwal");
    } finally {
      setSaving(false);
    }
  };

  const submitAjukanResmi = async () => {
    setSaving(true);
    try {
      await ajukanResmiKunjungan({ id });
      toast.success("Kunjungan berhasil didaftarkan resmi");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengajukan resmi");
    } finally {
      setSaving(false);
      setConfirmResmi(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detail Pengajuan Kunjungan"
        breadcrumb={[
          { label: "Pendataan" },
          { label: "Daftar Pengajuan Kunjungan", href: "/kunjungan/daftar" },
          { label: "Lihat" },
        ]}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/kunjungan/daftar">Kembali</Link>
          </Button>
        }
      />

      <Card className="shadow-sm">
        <CardContent className="space-y-6 p-6">
          <SuratIzinBox kunjunganId={id} />

          <div className="space-y-5 border-t border-border pt-4">
            {/* Header: Judul & Badges */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {JENIS_KUNJUNGAN_LABEL[data.jenis_kunjungan]}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatTanggalWaktu(data.tanggal_kunjungan)}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded border border-border bg-muted px-2.5 py-1 font-mono text-xs font-medium text-muted-foreground">
                  {data.kunjungan_code || "DRAFT"}
                </span>
                <KunjunganStatusBadge status={status} />
                <KunjunganTindakanBadge tindakan={data.tindakan} />
              </div>
            </div>

            {/* Grid Informasi Utama */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Asal Puskesmas" value={data.puskesmas_nama ?? "-"} />
              <Info label="Tanggal & Jam Kunjungan" value={formatTanggalWaktu(data.tanggal_kunjungan)} />
              <Info
                label="Usulan Jadwal Baru"
                value={showUbahJadwal && hasInputBaru ? `${tanggalBaru} ${jamBaru}` : "Tidak Ada Usulan"}
                highlight={showUbahJadwal && hasInputBaru}
              />
              <Info label="Pembuatan Data" value={formatTanggalWaktu(data.created_at)} />
              <Info label="Perubahan Data Terakhir" value={formatTanggalWaktu(data.updated_at)} />
              <Info label="Petugas / Perawat" value={data.perawat_nama ?? "Menunggu Penugasan"} />
            </div>

            {/* Perihal Kunjungan */}
            {data.perihal && (
              <div className="rounded-lg bg-muted/30 p-4 border border-border/50">
                <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">Perihal Kunjungan</p>
                <p className="mt-1.5 text-sm text-foreground leading-relaxed">{data.perihal}</p>
              </div>
            )}

            {/* Banner Status Edukatif bagi Keluarga */}
            {isDraft ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Status Pengajuan: Draft (Belum Resmi)</p>
                  <p className="leading-relaxed">
                    Pengajuan ini masih tersimpan sebagai draf. Silakan periksa kembali jadwal dan detailnya. Klik tombol <strong className="font-semibold">"Ajukan Resmi"</strong> di bawah agar dapat diverifikasi oleh pihak Puskesmas.
                  </p>
                </div>
              </div>
            ) : isPengajuan ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Pengajuan Menunggu Persetujuan</p>
                  <p className="leading-relaxed">
                    Pengajuan kunjungan Anda telah terdaftar. Saat ini sedang dalam proses verifikasi dan peninjauan oleh pihak <strong className="font-semibold">{data.puskesmas_nama ?? "Puskesmas"}</strong>.
                  </p>
                </div>
              </div>
            ) : isProsesOrDisetujui ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Pengajuan telah disetujui</p>
                  <p className="leading-relaxed">
                    Pengajuan kunjungan Anda telah terdaftar. Tim medis dari <strong className="font-semibold">{data.puskesmas_nama ?? "Puskesmas"}</strong> akan memproses jadwal ini.
                  </p>
                </div>
              </div>
            ) : isSelesai ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Kunjungan telah berakhir</p>
                  <p className="leading-relaxed">
                    Kunjungan Anda telah selesai, untuk detail medisnya bisa lihat di menu{" "}
                    <Link 
                      href="/asuhan-keperawatan" 
                      className="font-semibold underline underline-offset-2 hover:text-primary"
                    >
                      Daftar Asuhan Keperawatan
                    </Link>
                  </p>
                </div>
              </div>
            ) : null}

            {/* Form Ubah Jadwal (Hanya tampil saat status DRAFT) */}
            {isDraft && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Ingin Mengubah Jadwal Sebelum Mengajukan?</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => (showUbahJadwal ? clearBoxUbahJadwal() : setShowUbahJadwal(true))}
                  >
                    {showUbahJadwal ? "Batal Ubah Jadwal" : "Ajukan Perubahan Jadwal"}
                  </Button>
                </div>

                {showUbahJadwal && (
                  <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <Label className="text-sm font-semibold text-foreground">Pengajuan Tanggal &amp; Jam Kunjungan Baru</Label>
                      <span className="text-xs text-muted-foreground">Formulir Usulan Perubahan</span>
                    </div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="space-y-1.5 flex-1">
                        <Label className="text-xs text-muted-foreground">Pilih Tanggal Baru</Label>
                        <Input type="date" value={tanggalBaru} onChange={(e) => setTanggalBaru(e.target.value)} className="bg-background" />
                      </div>
                      <div className="space-y-1.5 sm:w-40">
                        <Label className="text-xs text-muted-foreground">Pilih Jam Baru</Label>
                        <Input type="time" value={jamBaru} onChange={(e) => setJamBaru(e.target.value)} className="bg-background" />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                      {hasInputBaru && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setTanggalBaru(""); setJamBaru(""); }} className="text-destructive hover:bg-destructive/10">
                          Hapus
                        </Button>
                      )}
                      <Button type="button" size="sm" disabled={saving || !hasInputBaru} onClick={submitUbahJadwal}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan Usulan
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Footer untuk Klik "Ajukan Resmi" (Hanya tampil saat status DRAFT) */}
          {isDraft && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Jika tanggal &amp; jam di atas sudah sesuai, klik tombol di sebelah kanan untuk mengirimkan pengajuan resmi.
              </p>
              <Button type="button" size="default" disabled={saving} onClick={() => setConfirmResmi(true)}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Ajukan Resmi
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmResmi}
        onOpenChange={setConfirmResmi}
        title="Daftarkan resmi kunjungan ini?"
        description={`Puskesmas: ${data.puskesmas_nama ?? "-"} · Jenis: ${JENIS_KUNJUNGAN_LABEL[data.jenis_kunjungan]} · Tanggal & jam: ${formatTanggalWaktu(data.tanggal_kunjungan)}. Data ini akan didaftarkan resmi ke pihak Puskesmas.`}
        confirmLabel="Daftarkan"
        onConfirm={submitAjukanResmi}
      />
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border transition-colors ${highlight ? "border-primary/50 bg-primary/5" : "bg-muted/20 border-border/40"}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  );
}