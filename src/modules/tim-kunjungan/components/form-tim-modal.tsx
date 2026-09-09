import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usersService, type UserRow } from "@/services/users.service";
import { timKunjunganService, type TimKunjunganRow } from "@/services/tim-kunjungan.service";
import { ROLES } from "@/lib/constants/roles";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit" | "view";
  initialData: TimKunjunganRow | null;
  onSaved: () => void;
}

export function FormTimModal({ open, onOpenChange, mode, initialData, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [perawatList, setPerawatList] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [statusAktif, setStatusAktif] = useState<boolean>(true);

  useEffect(() => {
    if (open) {
      if (mode === "add") {
        setSelectedUser("");
        setStatusAktif(true);
      } else if (initialData) {
        setSelectedUser(initialData.user_id);
        setStatusAktif(initialData.status_aktif);
      }
      loadPerawat();
    }
  }, [open, mode, initialData]);

  const loadPerawat = async () => {
    setLoading(true);
    try {
      const allUsers = await usersService.list();
      // Only active perawat
      setPerawatList(allUsers.filter(u => u.role === ROLES.PERAWAT && u.is_active));
    } catch (err) {
      toast.error("Gagal memuat daftar perawat");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") {
      onOpenChange(false);
      return;
    }

    if (!selectedUser) {
      toast.error("Silakan pilih pengguna");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "add") {
        await timKunjunganService.create({ user_id: selectedUser, status_aktif: statusAktif });
        toast.success("Tim kunjungan berhasil ditambahkan");
      } else if (mode === "edit" && initialData) {
        await timKunjunganService.update(initialData.id, { status_aktif: statusAktif });
        toast.success("Status tim kunjungan berhasil diperbarui");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = mode === "view";
  const title = mode === "add" ? "Tambah Tim Kunjungan" : mode === "edit" ? "Edit Tim Kunjungan" : "Detail Tim Kunjungan";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Pengguna (Perawat)</Label>
              {mode === "add" ? (
                <Select value={selectedUser} onValueChange={setSelectedUser} disabled={loading || submitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih perawat..." />
                  </SelectTrigger>
                  <SelectContent>
                    {perawatList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-md border p-2.5 text-sm bg-muted/50">
                  {initialData?.user_name || "—"}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
              <div className="space-y-0.5">
                <Label className="text-base">Status Aktif</Label>
                <p className="text-sm text-muted-foreground">
                  Hanya tim aktif yang dapat dipilih saat Tindak Lanjut.
                </p>
              </div>
              <Switch
                checked={statusAktif}
                onCheckedChange={setStatusAktif}
                disabled={isReadOnly || submitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {isReadOnly ? "Tutup" : "Batal"}
            </Button>
            {!isReadOnly && (
              <Button type="submit" disabled={submitting || (mode === "add" && !selectedUser)}>
                {submitting ? "Menyimpan..." : "Simpan"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
