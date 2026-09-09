import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES, ROLE_LABELS, type AppRole } from "@/lib/constants/roles";
import { updateUser } from "@/lib/users.functions";
import { puskesmasService, type Puskesmas } from "@/services/puskesmas.service";
import type { UserRow } from "@/services/users.service";

const schema = z.object({
  username: z.string().trim().optional(),
  full_name: z.string().trim().min(1, "Nama lengkap wajib diisi"),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid (contoh: nama@domain.com)")
    .optional()
    .or(z.literal("")),
  phone_local: z
    .string()
    .trim()
    .regex(/^(8\d{7,13})?$/, "Telepon harus diawali 8 (tanpa 0), contoh: 81234567890")
    .optional()
    .or(z.literal("")),
  role: z.enum(["admin_dinkes", "admin_puskesmas", "perawat", "keluarga"]),
  puskesmas_id: z.string().optional(),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
  currentRole: AppRole;
  onSaved: () => void;
}

export function EditUserDialog({ open, onOpenChange, user, currentRole, onSaved }: Props) {
  const isDinkes = currentRole === ROLES.ADMIN_DINKES;
  const availableRoles: AppRole[] = isDinkes
    ? [ROLES.ADMIN_DINKES, ROLES.ADMIN_PUSKESMAS, ROLES.PERAWAT]
    : [ROLES.PERAWAT];

  const stripPhone = (p: string | null | undefined): string => {
    if (!p) return "";
    return p.replace(/^\+62\s*/, "").replace(/\D/g, "");
  };

  // 1. SEMUA HOOK DIPANGGIL PALING ATAS
  const [puskesmasList, setPuskesmasList] = useState<Puskesmas[]>([]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user?.username ?? "",
      full_name: user?.full_name ?? "",
      email: user?.email ?? "",
      phone_local: stripPhone(user?.phone),
      role: (user?.role ?? ROLES.KELUARGA) as AppRole,
      puskesmas_id: user?.puskesmas_id ?? "",
    },
  });

  // Otomatis isikan data pengguna yang diedit saat dialog terbuka
  useEffect(() => {
    if (open && user) {
      if (isDinkes) {
        void puskesmasService.list().then(setPuskesmasList).catch(() => {});
      }
      form.reset({
        username: user.username ?? "",
        full_name: user.full_name ?? "",
        email: user.email ?? "",
        phone_local: stripPhone(user.phone),
        role: (user.role ?? ROLES.KELUARGA) as AppRole,
        puskesmas_id: user.puskesmas_id ?? "",
      });
    }
  }, [open, user, isDinkes, form]);

  // 2. PENGECEKAN RETURN BARU BOLEH DITULIS SETELAH HOOK
  if (!user) return null;

  const role = form.watch("role");
  const needsPuskesmas = isDinkes && role !== ROLES.ADMIN_DINKES;

  const onSubmit = async (v: Values) => {
    try {
      const phone = v.phone_local ? `+62 ${v.phone_local}` : "";
      await updateUser({
        user_id: user.id,
        full_name: v.full_name.trim(),
        email: v.email?.trim() || null,
        phone,
        role: v.role,
        puskesmas_id: v.role === ROLES.ADMIN_DINKES ? null : (v.puskesmas_id || null),
      });
      toast.success("Data pengguna berhasil diperbarui");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui pengguna");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pengguna</DialogTitle>
          <DialogDescription>
            Perbarui data dan peran pengguna.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit)} 
            className="space-y-4"
            autoComplete="off"
          >
            {/* Input jebakan pencegah autofill otomatis browser */}
            <input type="text" name="fake_username" style={{ display: "none" }} tabIndex={-1} />
            <input type="password" name="fake_password" style={{ display: "none" }} tabIndex={-1} />

            {/* Grid 2 Kolom: Username & Peran */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled
                        autoComplete="off"
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peran *</FormLabel>
                    <FormControl>
                      {!isDinkes || availableRoles.length <= 1 ? (
                        <Input
                          value={ROLE_LABELS[field.value] || field.value}
                          disabled
                          autoComplete="off"
                          className="bg-muted text-muted-foreground cursor-not-allowed"
                        />
                      ) : (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableRoles.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Nama Lengkap */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama lengkap *</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="contoh@email.com"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Telepon */}
            <FormField
              control={form.control}
              name="phone_local"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telepon</FormLabel>
                  <FormControl>
                    <div className="flex">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                        +62
                      </span>
                      <Input
                        {...field}
                        inputMode="numeric"
                        placeholder="8XXXXXXXXXX"
                        autoComplete="off"
                        className="rounded-l-none"
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          field.onChange(v);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Tanpa 0 di depan. Contoh: 81234567890
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Puskesmas */}
            {needsPuskesmas && (
              <FormField
                control={form.control}
                name="puskesmas_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Puskesmas *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Puskesmas" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {puskesmasList.map((p) => (
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
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || (needsPuskesmas && !form.watch("puskesmas_id"))}
              >
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}