import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  keluargaSchema,
  type KeluargaFormValues,
} from "@/modules/keluarga/schemas/keluarga.schema";
import { STATUS_KELUARGA_OPTIONS, STATUS_LABEL, type KeluargaRow } from "@/modules/keluarga/types";
import { createKeluarga, updateKeluarga } from "@/lib/keluarga.functions";
import { puskesmasService, type Puskesmas } from "@/services/puskesmas.service";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants/roles";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: KeluargaRow | null;
  onSaved: () => void;
}

export function KeluargaFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const { role, profile } = useAuth();
  const [puskList, setPuskList] = useState<Puskesmas[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<KeluargaFormValues>({
    resolver: zodResolver(keluargaSchema),
    defaultValues: {
      nomor_kk: "",
      kepala_keluarga: "",
      nik: "",
      alamat: "",
      telepon: "",
      status: "aktif",
      puskesmas_id: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    void puskesmasService.list().then((rows) => {
      setPuskList(rows.filter((p) => p.status === "aktif"));
      if (role !== ROLES.ADMIN_DINKES && profile?.puskesmas_id) {
        form.setValue("puskesmas_id", profile.puskesmas_id);
      }
    });
    form.reset({
      nomor_kk: initial?.nomor_kk ?? "",
      kepala_keluarga: initial?.kepala_keluarga ?? "",
      nik: initial?.nik ?? "",
      alamat: initial?.alamat ?? "",
      telepon: initial?.telepon ?? "",
      status: initial?.status ?? "aktif",
      puskesmas_id: initial?.puskesmas_id ?? profile?.puskesmas_id ?? "",
    });
  }, [open, initial, role, profile, form]);

  const onSubmit = async (values: KeluargaFormValues) => {
    setSubmitting(true);
    try {
      if (initial) {
        await updateKeluarga({ id: initial.id, patch: values });
        toast.success("Data keluarga berhasil diperbarui");
      } else {
        await createKeluarga({ data: values });
        toast.success("Keluarga berhasil ditambahkan");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan keluarga";
      if (message.toLowerCase().includes("nomor kk"))
        form.setError("nomor_kk", { type: "server", message });
      if (message.toLowerCase().includes("nik")) form.setError("nik", { type: "server", message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isDinkes = role === ROLES.ADMIN_DINKES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Keluarga" : "Tambah Keluarga"}</DialogTitle>
          <DialogDescription>
            Lengkapi data keluarga binaan sesuai Kartu Keluarga.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <FormField
              name="nomor_kk"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor KK</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      maxLength={16}
                      placeholder="16 digit angka"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="kepala_keluarga"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kepala Keluarga</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama lengkap" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="nik"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIK Kepala Keluarga</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      maxLength={16}
                      placeholder="16 digit angka"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="telepon"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telepon</FormLabel>
                  <FormControl>
                    <Input placeholder="+62 8XXX (opsional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="alamat"
              control={form.control}
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Alamat</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Alamat lengkap (opsional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isDinkes ? (
              <FormField
                name="puskesmas_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Puskesmas</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Puskesmas" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {puskList.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nama_puskesmas}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initial ? "Simpan Perubahan" : "Simpan Keluarga"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
