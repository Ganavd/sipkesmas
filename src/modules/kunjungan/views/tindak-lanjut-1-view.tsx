"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FileText, X, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/page-header";
import { timKunjunganService, type TimKunjunganRow } from "@/services/tim-kunjungan.service";
import { submitTindakLanjut1 } from "@/lib/tindak-lanjut.functions";
import { kunjunganService } from "@/services/kunjungan.service";
import { supabase } from "@/integrations/supabase/client";
import { attachmentService } from "@/services/attachment.service";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  id: string;
}

const MOBIL_OPTIONS = ["Mobil Pribadi", "Mobil Puskesmas"];

export function TindakLanjut1View({ id }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timList, setTimList] = useState<TimKunjunganRow[]>([]);
  const [kodeResmi, setKodeResmi] = useState<string | null>(null);
  const [kodeTerakhir, setKodeTerakhir] = useState<string | null>(null);
  const [kodeBerikutnya, setKodeBerikutnya] = useState("-");
  const [naskah, setNaskah] = useState<File | null>(null);

  const [selectedTim, setSelectedTim] = useState<string[]>([]);
  const [selectedMobil, setSelectedMobil] = useState<string[]>([]);
  const [catatan, setCatatan] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [kunjungan, allTim] = await Promise.all([
          kunjunganService.getById(id),
          timKunjunganService.list(),
        ]);
        if (!kunjungan) {
          toast.error("Kunjungan tidak ditemukan");
          router.push("/kunjungan/daftar");
          return;
        }
        setTimList(allTim.filter((t) => t.status_aktif));

        const { data: puskesmas } = await supabase
          .from("puskesmas")
          .select("kode")
          .eq("id", kunjungan.puskesmas_id)
          .single();
        const kode = puskesmas?.kode?.toUpperCase() || "PKM";
        setKodeResmi(
          kunjungan.kunjungan_code?.startsWith("DRAFT-") ? null : kunjungan.kunjungan_code,
        );

        const { data: kunjunganRows } = await supabase
          .from("kunjungan")
          .select("kunjungan_code")
          .eq("puskesmas_id", kunjungan.puskesmas_id)
          .is("deleted_at", null);
        const numbers = (kunjunganRows ?? [])
          .map((row) => row.kunjungan_code)
          .filter((code): code is string => Boolean(code) && code.startsWith(`${kode}-`))
          .map((code) => Number(code.slice(kode.length + 1)))
          .filter((number) => Number.isInteger(number));
        const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        setKodeTerakhir(
          numbers.length > 0 ? `${kode}-${String(Math.max(...numbers)).padStart(4, "0")}` : null,
        );
        setKodeBerikutnya(`${kode}-${String(next).padStart(4, "0")}`);
      } catch (err) {
        console.error("TL1 load error:", err);
        toast.error(`Gagal memuat data: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const toggleTim = (timId: string) => {
    setSelectedTim((prev) =>
      prev.includes(timId) ? prev.filter((x) => x !== timId) : [...prev, timId],
    );
  };

  const toggleMobil = (mobil: string) => {
    setSelectedMobil((prev) =>
      prev.includes(mobil) ? prev.filter((x) => x !== mobil) : [...prev, mobil],
    );
  };

  const handleReset = () => {
    setSelectedTim([]);
    setSelectedMobil([]);
    setCatatan("");
    setNaskah(null);
  };

  const handleFileChange = (file: File | null) => {
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("Ukuran file maksimal adalah 20MB");
        return;
      }
      if (file.type !== "application/pdf") {
        toast.error("Hanya format PDF yang diperbolehkan");
        return;
      }
      const nameWithoutExtension = file.name.substring(0, file.name.lastIndexOf("."));
      const invalidChars = /[.,!@#$%^&*()]/;
      if (invalidChars.test(nameWithoutExtension)) {
        toast.error("Nama file mengandung karakter yang tidak diperbolehkan");
        return;
      }
    }
    setNaskah(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMobil.length === 0) {
      toast.error("Silakan pilih minimal 1 mobil");
      return;
    }
    if (selectedTim.length === 0) {
      toast.error("Silakan pilih minimal 1 tim kunjungan");
      return;
    }

    setSubmitting(true);
    try {
      const { kunjungan } = await submitTindakLanjut1({
        id,
        tim_ids: selectedTim,
        mobil: selectedMobil,
        catatan,
      });
      if (naskah && user?.id) {
        await attachmentService.upload({
          file: naskah,
          entityType: "kunjungan",
          entityId: kunjungan.id,
          puskesmasId: kunjungan.puskesmas_id,
          uploadedBy: user.id,
        });
      }
      toast.success("Tindak lanjut 1 berhasil disimpan");
      // Use Link or window.location since mixing app dir router and tanstack router can be tricky
      window.location.href = `/kunjungan/${id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tindak Lanjut 1 Kunjungan"
        breadcrumb={[
          { label: "Pendataan" },
          { label: "Daftar Kunjungan", href: "/kunjungan/daftar" },
          { label: "Tindak Lanjut" },
        ]}
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={`/kunjungan/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </a>
          </Button>
        }
      />

      <form onSubmit={handleSubmit}>
        <Card className="w-full shadow-sm border-none bg-transparent">
          <CardContent className="space-y-12 p-2 sm:p-6">
            {/* Kode Otomatis Box */}
            <div className="flex flex-wrap items-center justify-between gap-x-12 gap-y-4 rounded-xl border border-border/80 bg-slate-50/80 p-6 sm:px-10 dark:bg-slate-900/30">
              <div className="flex items-center gap-4">
                <Hash className="h-8 w-8 text-muted-foreground/60" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kode Kunjungan Terakhir</p>
                  <p className="font-mono text-base font-bold text-foreground mt-0.5">{kodeTerakhir ?? "Belum ada"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Hash className="h-8 w-8 text-primary/60" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kode Kunjungan Baru (TL1)</p>
                  <p className="font-mono text-base font-bold text-primary mt-0.5">{kodeResmi ?? kodeBerikutnya}</p>
                </div>
              </div>
            </div>

            {/* Group Box untuk Tim dan Kendaraan */}
            <div className="rounded-2xl border-2 border-border/60 bg-card p-6 sm:p-10 shadow-sm">
              <div className="grid gap-12 lg:grid-cols-2">
                {/* Kolom Kiri: Tim Kunjungan */}
                <div className="space-y-8">
                  <Label className="text-lg font-semibold block mb-2">
                    Tim Kunjungan <span className="text-destructive">*</span>
                  </Label>
                  <div className="max-h-[400px] space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                    {timList.length === 0 ? (
                      <p className="text-sm italic text-muted-foreground">
                        Belum ada tim aktif yang tersedia. Tambahkan di menu Manajemen &gt; Tim Kunjungan.
                      </p>
                    ) : (
                      timList.map((tim) => (
                        <div key={tim.id} className="flex items-center space-x-4 group">
                          <Checkbox
                            id={`tim-${tim.user_id}`}
                            checked={selectedTim.includes(tim.user_id)}
                            onCheckedChange={() => toggleTim(tim.user_id)}
                            className="h-5 w-5 rounded-sm"
                          />
                          <label
                            htmlFor={`tim-${tim.user_id}`}
                            className="flex-1 cursor-pointer text-base leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            <span className="font-medium text-foreground group-hover:text-primary transition-colors">{tim.user_name}</span>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Mobil */}
                <div className="space-y-8">
                  <Label className="text-lg font-semibold block mb-2">
                    Pilihan Kendaraan <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex flex-col gap-6">
                    {MOBIL_OPTIONS.map((mobil) => (
                      <div key={mobil} className="flex items-center space-x-4">
                        <Checkbox
                          id={`mobil-${mobil}`}
                          checked={selectedMobil.includes(mobil)}
                          onCheckedChange={() => toggleMobil(mobil)}
                          className="h-5 w-5 rounded-sm"
                        />
                        <label
                          htmlFor={`mobil-${mobil}`}
                          className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {mobil}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Catatan Tambahan (Bawah Kendaraan) */}
            <div className="grid gap-12 lg:grid-cols-2 mt-8 px-6 sm:px-10">
              <div></div>
              <div className="space-y-4">
                <Label className="text-lg font-semibold block mb-2">Catatan Tambahan</Label>
                <Textarea
                  placeholder="Tuliskan catatan tambahan bila ada..."
                  className="min-h-[250px] resize-none text-base p-5 border-2 border-border/60 rounded-xl"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                />
              </div>
            </div>

            {/* Lampiran Upload */}
            <div className="mt-24 space-y-10 border-t border-border pt-16 mb-16">
              <div className="space-y-4">
                <Label className="text-xl font-medium text-foreground">Lampiran</Label>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Format yang didukung: PDF, maksimal per file 20 MB.<br/>
                  Mohon tidak menggunakan unsur (titik), (koma), symbol (!@#$%^&*()) pada nama file.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mt-8">
                {/* File Preview Area */}
                {naskah && (
                   <div className="flex items-center justify-between p-4 border-b border-border bg-muted/10">
                     <div className="flex items-center gap-4 overflow-hidden">
                       <FileText className="h-6 w-6 shrink-0 text-primary" />
                       <span className="truncate text-base font-medium">{naskah.name}</span>
                     </div>
                     <button type="button" onClick={() => setNaskah(null)} className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" aria-label="Hapus file">
                       <X className="h-5 w-5" />
                     </button>
                   </div>
                )}

                {/* Drag & Drop Area */}
                <div className="relative flex flex-col items-center justify-center p-16 text-center border-b border-border/50 border-dashed bg-muted/5 transition-colors hover:bg-muted/10">
                  <p className="text-base text-muted-foreground">
                    Untuk menambahkan File, seret dan lepas file tersebut ke sini, atau klik untuk memilih file.
                  </p>
                  <input type="file" accept="application/pdf,.pdf" className="absolute inset-0 z-10 cursor-pointer opacity-0" onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)} />
                </div>
                
                {/* Footer Area */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/20">
                  <span className="text-base text-muted-foreground font-medium pl-4">{naskah ? "1 file selected" : "0 file selected"}</span>
                  <label className="cursor-pointer">
                    <span className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      Browse
                    </span>
                    <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="mt-12 justify-end gap-6 border-t pt-10 pb-8 px-6">
            <Button type="button" variant="ghost" size="lg" onClick={handleReset} disabled={submitting}>
              Reset
            </Button>
            <Button type="submit" size="lg" disabled={submitting} className="px-10">
              {submitting ? "Memproses..." : "Tindak Lanjutkan"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

