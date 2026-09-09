import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { puskesmasService, type Puskesmas } from "@/services/puskesmas.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Puskesmas | null;
  onSaved: () => void;
}

export function PuskesmasFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const [form, setForm] = useState({
    nama_puskesmas: "",
    kode: "",
    alamat: "",
    kecamatan: "",
    kabupaten: "",
    telepon: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        nama_puskesmas: initial?.nama_puskesmas ?? "",
        kode: initial?.kode ?? "",
        alamat: initial?.alamat ?? "",
        kecamatan: initial?.kecamatan ?? "",
        kabupaten: initial?.kabupaten ?? "",
        telepon: initial?.telepon ?? "",
        email: initial?.email ?? "",
      });
    }
  }, [open, initial]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[A-Z]{3}$/.test(form.kode)) {
      toast.error("Kode Puskesmas wajib 3 huruf kapital (A-Z)");
      return;
    }
    setLoading(true);
    try {
      if (initial) {
        const { kode: _ignore, ...patch } = form;
        await puskesmasService.update(initial.id, patch);
        toast.success("Puskesmas berhasil diperbarui");
      } else {
        await puskesmasService.create(form);
        toast.success("Puskesmas berhasil ditambahkan");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Puskesmas" : "Tambah Puskesmas"}</DialogTitle>
          <DialogDescription>
            Lengkapi data Puskesmas. Field bertanda * wajib diisi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Puskesmas *</Label>
              <Input
                id="nama"
                required
                value={form.nama_puskesmas}
                onChange={(e) => setForm({ ...form, nama_puskesmas: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kode">Kode *</Label>
              <Input
                id="kode"
                required
                maxLength={3}
                disabled={!!initial}
                value={form.kode}
                onChange={(e) =>
                  setForm({ ...form, kode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })
                }
                placeholder="ABC"
                className="font-mono uppercase tracking-widest"
              />
            </div>
          </div>
          {!initial && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Kode 3 huruf kapital sebagai identitas Puskesmas (mis. JKT, BDG). Tidak dapat diubah setelah dibuat.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="alamat">Alamat</Label>
            <Input id="alamat" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="kecamatan">Kecamatan</Label>
              <Input id="kecamatan" value={form.kecamatan} onChange={(e) => setForm({ ...form, kecamatan: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kabupaten">Kabupaten</Label>
              <Input id="kabupaten" value={form.kabupaten} onChange={(e) => setForm({ ...form, kabupaten: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="telepon">Telepon</Label>
              <Input id="telepon" value={form.telepon} onChange={(e) => setForm({ ...form, telepon: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
