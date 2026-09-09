"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, History, LockKeyhole, Save, UserRound, Upload, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/src/hooks/use-auth";
import { ROLES } from "@/src/lib/constants/roles";
import { updateMyProfile } from "@/src/lib/profile.functions";

const profileFormSchema = z.object({
  full_name: z.string().trim().min(3, "Nama lengkap minimal 3 karakter"),
  username: z.string().trim().min(3, "Username minimal 3 karakter"),
  email: z.string().email("Format email tidak valid").or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  new_password: z.string().min(8, "Password baru minimal 8 karakter").or(z.literal("")),
  avatar_data: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function PengaturanPage() {
  const { role, profile, refresh } = useAuth();
  const canAudit = role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS;
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { full_name: "", username: "", email: "", phone: "", new_password: "" },
  });

  useEffect(() => {
    form.reset({
      full_name: profile?.full_name ?? "",
      username: profile?.username ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      new_password: "",
      avatar_data: undefined,
    });
  }, [profile, form]);

  const handleAvatarChange = (file: File | undefined) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.type)) {
      toast.error("Foto profil harus berformat JPG, JPEG, atau PNG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran foto profil maksimal 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      setAvatarPreview(value);
      form.setValue("avatar_data", value, { shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setSaving(true);
    try {
      await updateMyProfile(values);
      await refresh();
      form.setValue("new_password", "");
      form.setValue("avatar_data", undefined);
      setAvatarPreview(null);
      toast.success("Profil berhasil diperbarui");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui profil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Profil"
        description="Perbarui informasi akun dan keamanan login Anda."
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="w-full">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" /> Informasi Akun
            </CardTitle>
            <CardDescription>
              Informasi ini digunakan untuk identitas Anda di dalam sistem.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 p-6 md:grid-cols-2">
            <div className="flex items-center gap-5 md:col-span-2">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-soft text-primary">
                {avatarPreview || profile?.avatar_url ? (
                  <img
                    src={avatarPreview || profile?.avatar_url || ""}
                    alt="Preview foto profil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound className="h-10 w-10" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar-upload">Foto Profil</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label htmlFor="avatar-upload" className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" /> Pilih Foto
                    </label>
                  </Button>
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAvatarPreview(null);
                        form.setValue("avatar_data", undefined);
                      }}
                    >
                      <X className="mr-1 h-4 w-4" /> Hapus
                    </Button>
                  )}
                </div>
                <input
                  id="avatar-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(event) => handleAvatarChange(event.target.files?.[0])}
                />
                <p className="text-xs text-muted-foreground">
                  Format JPG, JPEG, atau PNG. Maksimal 2 MB.
                </p>
              </div>
            </div>
            <FormInput label="Nama Lengkap" error={form.formState.errors.full_name?.message}>
              <Input {...form.register("full_name")} placeholder="Nama lengkap" />
            </FormInput>
            <FormInput label="Username" error={form.formState.errors.username?.message}>
              <Input {...form.register("username")} placeholder="username" />
            </FormInput>
            <FormInput label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} placeholder="nama@contoh.com" />
            </FormInput>
            <FormInput label="Nomor Telepon" error={form.formState.errors.phone?.message}>
              <Input {...form.register("phone")} placeholder="+62 8XXX (opsional)" />
            </FormInput>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-primary" /> Keamanan Akun
            </CardTitle>
            <CardDescription>Kosongkan password jika tidak ingin mengubahnya.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 p-6 md:grid-cols-2">
            <FormInput label="Password Baru" error={form.formState.errors.new_password?.message}>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  {...form.register("new_password")}
                  placeholder="Minimal 8 karakter"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                  aria-label="Tampilkan password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormInput>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="min-w-40">
            <Save className="mr-2 h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {canAudit && (
          <Link
            href="/audit-log"
            className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                <History className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Catatan Aktivitas</p>
                <p className="text-xs text-muted-foreground">
                  Lihat riwayat aksi pada sistem untuk audit.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-primary group-hover:underline">
              Buka catatan aktivitas →
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}

function FormInput({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
