"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Hash } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { PageHeader } from "@/components/common/page-header";

import { keluargaSchema } from "@/src/modules/keluarga/schemas/keluarga.schema";
import { updateKeluarga } from "@/actions/keluarga";
import { puskesmasService, type Puskesmas } from "@/src/services/puskesmas.service";
import { useAuth } from "@/src/hooks/use-auth";
import { ROLES } from "@/src/lib/constants/roles";
import { supabase } from "@/src/integrations/supabase/client";
import { KeluargaAuthEditForm } from "@/src/modules/keluarga/components/keluarga-auth-edit-form";

type EditKeluargaValues = z.infer<typeof keluargaSchema>;

export default function KeluargaEditPage() {
  const router = useRouter();
  const params = useParams();
  const keluargaId = params?.keluargaId as string;
  const { role, profile } = useAuth();
  
  const [puskList, setPuskList] = useState<Puskesmas[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keluargaCode, setKeluargaCode] = useState<string>("");

  const form = useForm<EditKeluargaValues>({
    resolver: zodResolver(keluargaSchema),
    defaultValues: {
      nomor_kk: "", kepala_keluarga: "", nik: "", alamat: "", telepon: "",
      status: "aktif", puskesmas_id: "",
    },
  });

  const watchPuskesmasId = form.watch("puskesmas_id");

  /* Load puskesmas list */
  useEffect(() => {
    void puskesmasService.list().then((rows) => {
      setPuskList(rows.filter((p) => p.status === "aktif"));
    });
  }, []);

  /* Fetch initial data */
  useEffect(() => {
    if (!keluargaId) return;
    setLoading(true);
    supabase
      .from("keluarga")
      .select("*")
      .eq("id", keluargaId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Gagal memuat data keluarga");
          router.push("/keluarga");
          return;
        }
        form.reset({
          nomor_kk: data.nomor_kk ?? "",
          kepala_keluarga: data.kepala_keluarga ?? "",
          nik: data.nik ?? "",
          alamat: data.alamat ?? "",
          telepon: data.telepon ?? "",
          status: (data.status as any) ?? "aktif",
          puskesmas_id: data.puskesmas_id ?? "",
        });
        setKeluargaCode(data.keluarga_code ?? "");
        setLoading(false);
      });
  }, [keluargaId, form, router]);

  /* ---------- Submit ---------- */
  const onSubmit = async (values: EditKeluargaValues) => {
    setSubmitting(true);
    try {
      await updateKeluarga({ id: keluargaId, patch: values });
      toast.success("Data keluarga berhasil diperbarui");
      router.push("/keluarga");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
    } finally {
      setSubmitting(false);
    }
  };

  const isDinkes = role === ROLES.ADMIN_DINKES;

  const inputKuning = "h-12 text-base";
  const inputBiru = "h-12 text-base";
  const inputHijau = "h-12 text-base";
  const textareaHijau = "text-base";

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Keluarga"
        description="Perbarui data keluarga binaan."
        actions={
          <Button variant="outline" onClick={() => router.push("/keluarga")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Data Keluarga</CardTitle>
          <CardDescription>Pastikan NIK dan Nomor KK terisi 16 digit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {keluargaCode && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Kode Keluarga</p>
                    <p className="font-mono text-sm font-bold text-foreground">{keluargaCode}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField name="nomor_kk" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor KK <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input inputMode="numeric" maxLength={16} placeholder="16 digit angka" className={inputKuning} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="nik" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIK Kepala Keluarga <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input inputMode="numeric" maxLength={16} placeholder="16 digit angka" className={inputKuning} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="kepala_keluarga" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kepala Keluarga <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="Nama lengkap" className={inputBiru} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="telepon" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telepon</FormLabel>
                    <FormControl><Input placeholder="+62 8XXX (opsional)" className={inputHijau} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {isDinkes && (
                  <FormField name="puskesmas_id" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Puskesmas <span className="text-red-500">*</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className={inputHijau}><SelectValue placeholder="Pilih Puskesmas" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {puskList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nama_puskesmas}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              <div className="grid grid-cols-1">
                <FormField name="alamat" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alamat</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Alamat lengkap (opsional)" className={textareaHijau} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => form.reset()}>
                  Reset
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ubah
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <KeluargaAuthEditForm keluargaId={keluargaId} />
    </div>
  );
}
