import { useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  isRegistered: boolean;
  canRegister: boolean;
  canOverride: boolean;
  onRegister: (note: string) => Promise<void> | void;
  onOverride?: (note: string) => Promise<void> | void;
  busy?: boolean;
}

/**
 * Bar aksi workflow: Daftarkan (draft) / Override (registered, admin_dinkes).
 */
export function WorkflowActionBar({
  isRegistered,
  canRegister,
  canOverride,
  onRegister,
  onOverride,
  busy,
}: Props) {
  const [open, setOpen] = useState<null | "register" | "override">(null);
  const [note, setNote] = useState("");

  const close = () => {
    setOpen(null);
    setNote("");
  };

  const submit = async () => {
    if (open === "register") await onRegister(note);
    if (open === "override" && onOverride) await onOverride(note);
    close();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isRegistered && canRegister && (
        <Button size="sm" onClick={() => setOpen("register")} disabled={busy}>
          <CheckCircle2 className="mr-1 h-4 w-4" /> Daftarkan
        </Button>
      )}
      {isRegistered && canOverride && (
        <Button size="sm" variant="destructive" onClick={() => setOpen("override")} disabled={busy}>
          <ShieldAlert className="mr-1 h-4 w-4" /> Override
        </Button>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => (!o ? close() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "register" ? "Daftarkan data" : "Override data terdaftar"}
            </DialogTitle>
            <DialogDescription>
              {open === "register"
                ? "Setelah didaftarkan, data menjadi resmi dan tidak dapat diubah kecuali oleh Admin Dinkes."
                : "Tindakan ini akan mengubah data yang sudah resmi. Sertakan alasan yang jelas."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="wf-note">
              Catatan workflow {open === "override" ? "(wajib)" : "(opsional)"}
            </Label>
            <Textarea
              id="wf-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Alasan / catatan operasional..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              Batal
            </Button>
            <Button
              onClick={submit}
              disabled={busy || (open === "override" && note.trim().length < 3)}
            >
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}