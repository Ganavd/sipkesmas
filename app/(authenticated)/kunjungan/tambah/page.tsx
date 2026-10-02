"use client";

import { useEffect, useMemo, useState, Suspense, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, X, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { SearchCombobox, type ComboboxOption } from "@/components/common/search-combobox";
import { cn } from "@/lib/utils";

import { keluargaService } from "@/src/services/keluarga.service";
import { puskesmasService, type Puskesmas } from "@/src/services/puskesmas.service";
import type { KeluargaWithRelations } from "@/src/modules/keluarga/types";
import { JENIS_KUNJUNGAN_LABEL, JENIS_KUNJUNGAN_OPTIONS, JENIS_KUNJUNGAN_AKTIF, type JenisKunjungan } from "@/src/modules/kunjungan/types";
import { createKunjungan } from "@/actions/kunjungan";
import { attachmentService } from "@/src/services/attachment.service";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";

function todayDate() { return new Date().toISOString().slice(0, 10); }
function nowTime() { return new Date().toTimeString().slice(0, 5); }

/**
 * Gabungkan tanggal (YYYY-MM-DD) dan jam (HH:mm) menjadi ISO string
 * dengan offset WIB (+07:00) agar tidak ada pergeseran jam saat disimpan.
 */
function toWIBIso(tanggal: string, jam: string): string {
  return `${tanggal}T${jam}:00+07:00`;
}

const emptyForm = {
  keluarga_id: "",
  puskesmas_filter: "",
  jenis_kunjungan: "rumah" as JenisKunjungan,
  status: "draft" as "draft" | "terdaftar",
  dibuatTanggal: todayDate(),
  dibuatJam: nowTime(),
  tanggal: "",
  jam: "",
  perihal: "",
};

function Field({
  label, required, invalid, children,
}: { label: string; required?: boolean; invalid?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className={cn(invalid && "text-destructive")}>
        {label}{required && " *"}
      </Label>
      {children}
      {invalid && <p className="text-xs text-destructive">*mohon di isikan</p>}
    </div>
  );
}

function KunjunganTambahPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, profile, user } = useAuth();
  const isDinkes = role === ROLES.ADMIN_DINKES;

  const [keluargaList, setKeluargaList] = useState<KeluargaWithRelations[]>([]);
  const [puskesmasList, setPuskesmasList] = useState<Puskesmas[]>([]);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    keluarga_id: searchParams.get("keluarga_id") ?? "",
  }));
  const [suratIzin, setSuratIzin] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    void keluargaService.list().then(setKeluargaList).catch(() => {});
    void puskesmasService.list().then(setPuskesmasList).catch(() => {});
  }, []);

  const ownPuskesmasNama = useMemo(() => {
    if (isDinkes) return null;
    return puskesmasList.find((p) => p.id === profile?.puskesmas_id)?.nama_puskesmas ?? "Puskesmas Jenangan";
  }, [isDinkes, puskesmasList, profile?.puskesmas_id]);

  const keluargaOptions: ComboboxOption[] = useMemo(() => {
    const filtered = isDinkes && form.puskesmas_filter
      ? keluargaList.filter((k) => k.puskesmas_id === form.puskesmas_filter)
      : keluargaList;
    return filtered.map((k) => ({
      value: k.id,
      label: k.kepala_keluarga,
      sublabel: `${k.keluarga_code}${k.puskesmas_nama ? " · " + k.puskesmas_nama : ""}`,
    }));
  }, [isDinkes, keluargaList, form.puskesmas_filter]);

  const puskesmasOptions: ComboboxOption[] = useMemo(
    () => puskesmasList.map((p) => ({ value: p.id, label: p.nama_puskesmas, sublabel: p.kode })),
    [puskesmasList],
  );

  const isBackdated = form.dibuatTanggal < todayDate();

  useEffect(() => {
    if (!isBackdated) setForm((f) => ({ ...f, dibuatJam: nowTime() }));
  }, [isBackdated]);

  const errors = {
    keluarga_id: !form.keluarga_id,
    tanggal: !form.tanggal || !form.jam,
  };
  const hasError = Object.values(errors).some(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (hasError) return;

    setLoading(true);
    try {
      const { kunjungan } = await createKunjungan({
        keluarga_id: form.keluarga_id,
        jenis_kunjungan: form.jenis_kunjungan,
        perihal: form.perihal,
        tanggal_kunjungan: toWIBIso(form.tanggal, form.jam),
        status: form.status,
        dibuat_at: isBackdated ? toWIBIso(form.dibuatTanggal, form.dibuatJam) : undefined,
      });

      if (suratIzin && user?.id) {
        try {
          await attachmentService.upload({
            file: suratIzin,
            entityType: "kunjungan",
            entityId: kunjungan.id,
            puskesmasId: kunjungan.puskesmas_id,
            uploadedBy: user.id,
          });
        } catch (uploadErr) {
          toast.error(
            uploadErr instanceof Error
              ? `Kunjungan tersimpan, tapi lampiran gagal diunggah: ${uploadErr.message}`
              : "Kunjungan tersimpan, tapi lampiran gagal diunggah.",
          );
        }
      }

      toast.success("Kunjungan berhasil ditambahkan.");
      router.push("/kunjungan/log");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan kunjungan");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setForm({ ...emptyForm, keluarga_id: searchParams.get("keluarga_id") ?? "" });
    setSuratIzin(null);
    setAttempted(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tambah Kunjungan"
        breadcrumb={[{ label: "Pendataan" }, { label: "Tambah Kunjungan" }]}
      />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-5" noValidate>
            {isDinkes ? (
              <Field label="Puskesmas">
                <SearchCombobox
                  options={puskesmasOptions}
                  value={form.puskesmas_filter}
                  onChange={(v) => setForm({ ...form, puskesmas_filter: v, keluarga_id: "" })}
                  placeholder="Cari puskesmas..."
                />
              </Field>
            ) : (
              <Field label="Puskesmas">
                <Input value={ownPuskesmasNama ?? ""} disabled className="bg-muted" />
              </Field>
            )}

            <Field label="Keluarga" required invalid={attempted && errors.keluarga_id}>
              <SearchCombobox
                options={keluargaOptions}
                value={form.keluarga_id}
                onChange={(v) => setForm({ ...form, keluarga_id: v })}
                placeholder="Cari nama kepala keluarga..."
                emptyText="Keluarga tidak ditemukan."
              />
            </Field>

            <Field label="Jenis" required>
              <RadioGroup
                value={form.jenis_kunjungan}
                onValueChange={(v) => setForm({ ...form, jenis_kunjungan: v as JenisKunjungan })}
                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              >
                {JENIS_KUNJUNGAN_OPTIONS.map((j) => {
                  const aktif = JENIS_KUNJUNGAN_AKTIF.includes(j);
                  return (
                    <Label
                      key={j}
                      htmlFor={`jenis-${j}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md border border-border p-3 text-sm",
                        aktif ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                      )}
                    >
                      <RadioGroupItem id={`jenis-${j}`} value={j} disabled={!aktif} />
                      {JENIS_KUNJUNGAN_LABEL[j]}
                    </Label>
                  );
                })}
              </RadioGroup>
            </Field>

            <Field label="Status" required>
              <RadioGroup
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as "draft" | "terdaftar" })}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                <Label htmlFor="status-draft" className="flex items-center gap-2 rounded-md border border-border p-3 text-sm cursor-pointer">
                  <RadioGroupItem id="status-draft" value="draft" />
                  Draft
                </Label>
                <Label htmlFor="status-terdaftar" className="flex items-center gap-2 rounded-md border border-border p-3 text-sm cursor-pointer">
                  <RadioGroupItem id="status-terdaftar" value="terdaftar" />
                  Terdaftar
                </Label>
              </RadioGroup>
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tanggal & jam dibuat">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={form.dibuatTanggal}
                    max={todayDate()}
                    onChange={(e) => setForm({ ...form, dibuatTanggal: e.target.value })}
                  />
                  <Input
                    type="time"
                    value={form.dibuatJam}
                    disabled={!isBackdated}
                    onChange={(e) => setForm({ ...form, dibuatJam: e.target.value })}
                    className={cn(!isBackdated && "bg-muted text-muted-foreground")}
                  />
                </div>
              </Field>

              <Field label="Tanggal & jam kunjungan" required invalid={attempted && errors.tanggal}>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={form.tanggal}
                    onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                  />
                  <Input
                    type="time"
                    value={form.jam}
                    onChange={(e) => setForm({ ...form, jam: e.target.value })}
                  />
                </div>
              </Field>
            </div>

            <Field label="Perihal">
              <Textarea
                rows={3}
                value={form.perihal}
                onChange={(e) => setForm({ ...form, perihal: e.target.value })}
              />
            </Field>

            <Field label="Naskah Perizinan">
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2 rounded bg-muted px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{suratIzin ? suratIzin.name : "Belum ada file"}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <label>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => setSuratIzin(e.target.files?.[0] ?? null)}
                    />
                    <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">
                      <Plus className="h-3.5 w-3.5" /> Tambah
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSuratIzin(null)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" /> Hapus
                  </button>
                </div>
              </div>
            </Field>

            <div className="flex flex-col items-end gap-2 pt-2">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={reset}>Reset</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Tambah
                </Button>
              </div>
              {attempted && hasError && <p className="text-xs text-destructive">*cek kembali</p>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function KunjunganTambahPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Memuat form kunjungan...</span>
      </div>
    }>
      <KunjunganTambahPageContent />
    </Suspense>
  );
}