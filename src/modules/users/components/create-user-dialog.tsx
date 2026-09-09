import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
import { toast } from "sonner";
import { ROLES, ROLE_LABELS, type AppRole } from "@/lib/constants/roles";
import { createUser } from "@/lib/users.functions";
import { puskesmasService, type Puskesmas } from "@/services/puskesmas.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRole: AppRole;
  onCreated: () => void;
}

const schema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi"),
  full_name: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid (contoh: nama@domain.com)")
    .optional()
    .or(z.literal("")),
  phone_local: z
    .string()
    .trim()
    .regex(/^8\d{7,13}$/, "Telepon harus diawali 8 (tanpa 0), contoh: 81234567890")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
  role: z.enum(["admin_puskesmas", "perawat"]),
  puskesmas_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateUserDialog({ open, onOpenChange, currentRole, onCreated }: Props) {
  const isDinkes = currentRole === ROLES.ADMIN_DINKES;
  /* Keluarga accounts are auto-created via Tambah Keluarga form */
  const availableRoles: AppRole[] = isDinkes
    ? [ROLES.ADMIN_PUSKESMAS, ROLES.PERAWAT]
    : [ROLES.PERAWAT];

  const [puskesmasList, setPuskesmasList] = useState<Puskesmas[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      full_name: "",
      email: "",
      phone_local: "",
      password: "",
      role: "perawat",
      puskesmas_id: "",
    },
  });

  useEffect(() => {
    if (open && isDinkes) {
      void puskesmasService
        .list()
        .then(setPuskesmasList)
        .catch(() => {});
    }
    if (open) {
      form.reset({
        username: "",
        full_name: "",
        email: "",
        phone_local: "",
        password: "",
        role: "perawat",
        puskesmas_id: "",
      });
      setShowPassword(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const role = form.watch("role");
  const needsPuskesmas = isDinkes && role !== ROLES.ADMIN_DINKES;

  const onSubmit = async (values: FormValues) => {
    try {
      const phone = values.phone_local ? `+62 ${values.phone_local}` : "";
      await createUser({
        username: values.username.trim(),
        full_name: values.full_name?.trim() ?? "",
        email: values.email?.trim() || undefined,
        phone,
        password: values.password,
        role: values.role,
        puskesmas_id: values.puskesmas_id || null,
      });
      toast.success("Pengguna berhasil dibuat");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pengguna");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Pengguna</DialogTitle>
          <DialogDescription>
            Buat akun baru. Nama lengkap perawat otomatis terisi jika dikosongkan.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            autoComplete="off" // 1. Matikan autofill di level form
          >
            {/* 2. Dummy Input (Jebakan agar Chrome mengisi data tersimpan ke sini, bukan ke input asli) */}
            <input type="text" name="fake_username" style={{ display: "none" }} tabIndex={-1} />
            <input type="password" name="fake_password" style={{ display: "none" }} tabIndex={-1} />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username *</FormLabel>
                    <FormControl>
                      {/* 3. Tambahkan autoComplete="off" pada komponen Input */}
                      <Input {...field} autoComplete="off" />
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
                      {/* Jika opsi peran hanya 1 (Perawat), langsung kunci dengan Input disabled */}
                      {availableRoles.length <= 1 ? (
                        <Input
                          value={ROLE_LABELS[field.value] || "Perawat"}
                          disabled // <--- Bikin otomatis abu-abu & tidak bisa diklik
                          className="bg-muted text-muted-foreground cursor-not-allowed"
                        />
                      ) : (
                        /* Jika ke depan ada lebih dari 1 peran, dropdown Select tetap terbuka */
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

            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama lengkap</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        className="rounded-l-none"
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          field.onChange(v);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kata sandi *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password" // <--- TAMBAHKAN INI (Mencegah autofill kata sandi tersimpan)
                        {...field}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription>Minimal 8 karakter.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                disabled={
                  form.formState.isSubmitting || (needsPuskesmas && !form.watch("puskesmas_id"))
                }
              >
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Buat Pengguna
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
