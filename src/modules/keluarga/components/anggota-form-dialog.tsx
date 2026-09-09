import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { anggotaSchema, type AnggotaFormValues } from "@/modules/keluarga/schemas/keluarga.schema";
import { HUBUNGAN_OPTIONS } from "@/modules/keluarga/types";
import { updateAnggota, createAnggota } from "@/lib/keluarga.functions";
import type { AnggotaKeluargaRow } from "@/modules/keluarga/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  keluargaId: string;
  initial?: AnggotaKeluargaRow | null;
  onSaved: () => void;
}

export function AnggotaFormDialog({ open, onOpenChange, keluargaId, initial, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<AnggotaFormValues>({
    resolver: zodResolver(anggotaSchema),
    defaultValues: { nama: "", nik: "", hubungan: "Anak", tanggal_lahir: "", jenis_kelamin: undefined },
  });

  useEffect(() => { 
    if (open) {
      if (initial) {
        form.reset({
          nama: initial.nama,
          nik: initial.nik ?? "",
          hubungan: initial.hubungan as any,
          tanggal_lahir: initial.tanggal_lahir ?? "",
          jenis_kelamin: initial.jenis_kelamin ?? undefined,
        });
      } else {
        form.reset({ nama: "", nik: "", hubungan: "Anak", tanggal_lahir: "", jenis_kelamin: undefined });
      }
    }
  }, [open, initial, form]);

  const onSubmit = async (values: AnggotaFormValues) => {
    setSubmitting(true);
    try {
      if (initial) {
        await updateAnggota({ id: initial.id, patch: values });
        toast.success("Anggota keluarga diperbarui");
      } else {
        await createAnggota({ ...values, keluarga_id: keluargaId });
        toast.success("Anggota keluarga ditambahkan");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan anggota");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Anggota Keluarga" : "Tambah Anggota Keluarga"}</DialogTitle>
          <DialogDescription>Lengkapi data anggota keluarga.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField name="nama" control={form.control} render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nama Lengkap</FormLabel>
                <FormControl><Input placeholder="Nama anggota keluarga" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="nik" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>NIK (opsional)</FormLabel>
                <FormControl><Input inputMode="numeric" maxLength={16} placeholder="16 digit" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="hubungan" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Hubungan</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {HUBUNGAN_OPTIONS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="tanggal_lahir" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal Lahir</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="jenis_kelamin" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Jenis Kelamin</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
