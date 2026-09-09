import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { resetUserPassword } from "@/lib/users.functions";

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter")
      .regex(/[A-Za-z]/, "Harus mengandung huruf")
      .regex(/[0-9]/, "Harus mengandung angka"),
    confirm: z.string().min(1, "Konfirmasi kata sandi wajib diisi"),
  })
  .refine((v) => v.new_password === v.confirm, {
    path: ["confirm"],
    message: "Konfirmasi tidak sama dengan kata sandi",
  });

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userLabel: string;
}

export function ResetPasswordDialog({ open, onOpenChange, userId, userLabel }: Props) {
  const [show, setShow] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "", confirm: "" },
  });

  const onSubmit = async (v: Values) => {
    try {
      await resetUserPassword({ user_id: userId, new_password: v.new_password });
      toast.success(`Kata sandi ${userLabel} berhasil diperbarui`);
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui kata sandi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) form.reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Kata Sandi</DialogTitle>
          <DialogDescription>
            Mengubah kata sandi untuk <span className="font-medium text-foreground">{userLabel}</span>.
            Pengguna akan menggunakan kata sandi baru pada login berikutnya.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="new_password" render={({ field }) => (
              <FormItem>
                <FormLabel>Kata sandi baru</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={show ? "text" : "password"} {...field} className="pr-10" />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                      aria-label={show ? "Sembunyikan" : "Tampilkan"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormDescription>Minimal 8 karakter, kombinasi huruf dan angka.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="confirm" render={({ field }) => (
              <FormItem>
                <FormLabel>Konfirmasi kata sandi</FormLabel>
                <FormControl>
                  <Input type={show ? "text" : "password"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Kata Sandi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
