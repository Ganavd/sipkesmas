"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/page-header";
import { submitTindakLanjut2 } from "@/lib/tindak-lanjut.functions";
import { kunjunganService } from "@/services/kunjungan.service";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  id: string;
}

interface AskepFormRow {
  key: string;
  tanggal: string;
  pengkajian: string;
  diagnosis: string;
  intervensi: string;
  implementasi: string;
  evaluasi_s: string;
  evaluasi_o: string;
  evaluasi_a: string;
  evaluasi_p: string;
}

const createEmptyRow = (): AskepFormRow => ({
  key: crypto.randomUUID(),
  tanggal: new Date().toISOString().split("T")[0],
  pengkajian: "",
  diagnosis: "",
  intervensi: "",
  implementasi: "",
  evaluasi_s: "",
  evaluasi_o: "",
  evaluasi_a: "",
  evaluasi_p: "",
});

export function TindakLanjut2View({ id }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [rows, setRows] = useState<AskepFormRow[]>([createEmptyRow()]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const kunjungan = await kunjunganService.getById(id);
        if (!kunjungan) {
          toast.error("Kunjungan tidak ditemukan");
          router.push("/kunjungan/daftar");
          return;
        }
      } catch (err) {
        console.error("TL2 load error:", err);
        toast.error(`Gagal memuat data: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const addRow = () => {
    setRows([...rows, createEmptyRow()]);
  };

  const removeRow = (key: string) => {
    setRows(rows.filter(r => r.key !== key));
  };

  const updateRow = (key: string, field: keyof AskepFormRow, value: string) => {
    setRows(rows.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const handleReset = () => {
    setRows([createEmptyRow()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sesi tidak valid");
      return;
    }
    
    // Validasi
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.tanggal || !r.pengkajian || !r.diagnosis || !r.intervensi || !r.implementasi || 
          !r.evaluasi_s || !r.evaluasi_o || !r.evaluasi_a || !r.evaluasi_p) {
        toast.error(`Mohon lengkapi semua field pada baris ke-${i + 1}`);
        return;
      }
    }
    
    setSubmitting(true);
    try {
      await submitTindakLanjut2({
          kunjungan_id: id,
          askep_rows: rows.map(r => ({
            ...r,
            petugas: user.id
          }))
        });
      toast.success("Asuhan Keperawatan berhasil ditambahkan");
      window.location.href = `/askep`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Input Asuhan Keperawatan (TL 2)"
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {rows.map((row, index) => (
          <Card key={row.key} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-4 border-b">
              <CardTitle className="text-base font-semibold">Form Askep #{index + 1}</CardTitle>
              {rows.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.key)} className="text-destructive h-8">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input 
                    type="date" 
                    value={row.tanggal} 
                    onChange={(e) => updateRow(row.key, "tanggal", e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data Pengkajian</Label>
                  <Textarea 
                    value={row.pengkajian} 
                    onChange={(e) => updateRow(row.key, "pengkajian", e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Diagnosis Keperawatan</Label>
                  <Textarea 
                    value={row.diagnosis} 
                    onChange={(e) => updateRow(row.key, "diagnosis", e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rencana Intervensi</Label>
                  <Textarea 
                    value={row.intervensi} 
                    onChange={(e) => updateRow(row.key, "intervensi", e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Implementasi</Label>
                  <Textarea 
                    value={row.implementasi} 
                    onChange={(e) => updateRow(row.key, "implementasi", e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label className="text-base font-semibold mb-4 block">Evaluasi (SOAP)</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Subjektif (S)</Label>
                    <Textarea 
                      value={row.evaluasi_s} 
                      onChange={(e) => updateRow(row.key, "evaluasi_s", e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Objektif (O)</Label>
                    <Textarea 
                      value={row.evaluasi_o} 
                      onChange={(e) => updateRow(row.key, "evaluasi_o", e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assessment (A)</Label>
                    <Textarea 
                      value={row.evaluasi_a} 
                      onChange={(e) => updateRow(row.key, "evaluasi_a", e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan (P)</Label>
                    <Textarea 
                      value={row.evaluasi_p} 
                      onChange={(e) => updateRow(row.key, "evaluasi_p", e.target.value)} 
                      required 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
          <Button type="button" variant="outline" onClick={addRow} disabled={submitting}>
            <Plus className="mr-2 h-4 w-4" />
            Tambahkan Baris
          </Button>
          
          <div className="space-x-2">
            <Button type="button" variant="ghost" onClick={handleReset} disabled={submitting}>
              Reset
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Tambahkan"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
