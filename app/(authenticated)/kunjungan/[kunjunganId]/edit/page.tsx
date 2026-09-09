"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";

import { kunjunganService } from "@/services/kunjungan.service";
import {
  JENIS_KUNJUNGAN_LABEL, JENIS_KUNJUNGAN_OPTIONS, JENIS_KUNJUNGAN_AKTIF,
  type JenisKunjungan, type KunjunganWithRelations,
} from "@/modules/kunjungan/types";
import { updateKunjungan } from "@/actions/kunjungan";

function toDateInput(iso: string) { return iso.slice(0, 10); }
function toTimeInput(iso: string) { return new Date(iso).toISOString().slice(11, 16); }

export default function KunjunganEditPage() {
  const params = useParams();
  const router = useRouter();
  const kunjunganId = params.kunjunganId as string;

  const [data, setData] = useState<KunjunganWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jenis, setJenis] = useState<JenisKunjungan>("rumah");
  const [tanggal, setTanggal] = useState("");
  const [jam, setJam] = useState("");
  const [perihal, setPerihal] = useState("");

  useEffect(() => {
    kunjunganService.getById(kunjunganId).then((row) => {
      if (row) {
        setData(row);
        setJenis(row.jenis_kunjungan);
        setTanggal(toDateInput(row.tanggal_kunjungan));
        setJam(toTimeInput(row.tanggal_kunjungan));
        setPerihal(row.perihal ?? "");
      }
    }).finally(() => setLoading(false));
  }, [kunjunganId]);

  const reset = () => {
    if (!data) return;
    setJenis(data.jenis_kunjungan);
    setTanggal(toDateInput(data.tanggal_kunjungan));
    setJam(toTimeInput(data.tanggal_kunjungan));
    setPerihal(data.perihal ?? "");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateKunjungan({
        id: kunjunganId,
        patch: {
          jenis_kunjungan: jenis,
          perihal,
          tanggal_kunjungan: `${tanggal}T${jam}:00`,
        },
      });
      toast.success("Kunjungan berhasil diperbarui");
      router.push(`/kunjungan/${kunjunganId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Memuat...</div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Kunjungan tidak ditemukan.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ubah Kunjungan"
        breadcrumb={[
          { label: "Pendataan", href: "/kunjungan/daftar" },
          { label: "Daftar Kunjungan", href: "/kunjungan/daftar" },
          { label: "Ubah" },
        ]}
        actions={<Button variant="outline" onClick={() => router.push(`/kunjungan/${kunjunganId}`)}>Kembali</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Data Kunjungan</CardTitle>
          <CardDescription>
            Keluarga: <span className="font-medium text-foreground">{data.keluarga_nama}</span> ({data.keluarga_code})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label>Jenis *</Label>
              <RadioGroup value={jenis} onValueChange={(v) => setJenis(v as JenisKunjungan)} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {JENIS_KUNJUNGAN_OPTIONS.map((j) => {
                  const aktif = JENIS_KUNJUNGAN_AKTIF.includes(j);
                  return (
                    <Label
                      key={j}
                      htmlFor={`edit-jenis-${j}`}
                      className={`flex items-center gap-2 rounded-md border border-border p-3 text-sm ${aktif ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                    >
                      <RadioGroupItem id={`edit-jenis-${j}`} value={j} disabled={!aktif} />
                      {JENIS_KUNJUNGAN_LABEL[j]}
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-tanggal">Tanggal *</Label>
                <Input id="edit-tanggal" type="date" required value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-jam">Jam *</Label>
                <Input id="edit-jam" type="time" required value={jam} onChange={(e) => setJam(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-perihal">Perihal</Label>
              <Textarea id="edit-perihal" rows={3} value={perihal} onChange={(e) => setPerihal(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={reset}>Reset</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ubah
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}