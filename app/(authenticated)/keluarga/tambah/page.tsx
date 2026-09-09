"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Eye, EyeOff, Copy, Check, Hash } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";

import { keluargaSchema } from "@/src/modules/keluarga/schemas/keluarga.schema";
import { STATUS_KELUARGA_OPTIONS, STATUS_LABEL } from "@/src/modules/keluarga/types";
import { createKeluarga } from "@/actions/keluarga";
import { puskesmasService, type Puskesmas } from "@/src/services/puskesmas.service";
import { useAuth } from "@/src/hooks/use-auth";
import { ROLES } from "@/src/lib/constants/roles";
import { supabase } from "@/src/integrations/supabase/client";

/* ---------- Extended schema with account fields ---------- */
const tambahKeluargaSchema = keluargaSchema.extend({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});
type TambahKeluargaValues = z.infer<typeof tambahKeluargaSchema>;

/* ---------- Helpers ---------- */
function toTitleCaseNoSpace(str: string): string {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export default function KeluargaTambahPage() {
  const router = useRouter();
  const { role, profile } = useAuth();
  const [puskList, setPuskList] = useState<Puskesmas[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  /* Success dialog state */
  const [successData, setSuccessData] = useState<{
    keluarga: string;
    username: string;
    password: string;
  } | null>(null);

  /* Keluarga count per puskesmas for generating seq */

  const form = useForm<TambahKeluargaValues>({
    resolver: zodResolver(tambahKeluargaSchema),
    defaultValues: {
      nomor_kk: "",
      kepala_keluarga: "",
      nik: "",
      alamat: "",
      telepon: "",
      status: "aktif",
      puskesmas_id: profile?.puskesmas_id ?? "",
      username: "",
      password: "",
      full_name: "",
      email: "",
      phone: "",
    },
  });

  const watchPuskesmasId = form.watch("puskesmas_id");
  const watchKepala = form.watch("kepala_keluarga");

  /* Load puskesmas list */
  useEffect(() => {
    void puskesmasService.list().then((rows) => {
      setPuskList(rows.filter((p) => p.status === "aktif"));
      if (role !== ROLES.ADMIN_DINKES && profile?.puskesmas_id) {
        form.setValue("puskesmas_id", profile.puskesmas_id);
      }
    });
  }, [role, profile, form]);

  /* Fetch all existing keluarga codes for the selected puskesmas to determine gaps */
  const [existingCodes, setExistingCodes] = useState<string[]>([]);
  useEffect(() => {
    if (!watchPuskesmasId) {
      setExistingCodes([]);
      return;
    }
    const loadCodes = async () => {
      const keluargaQuery = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string,
            ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
      const result = await keluargaQuery
        .from("keluarga")
        .select("keluarga_code")
        .eq("puskesmas_id", watchPuskesmasId);
      const rows = result.data ?? [];
      setExistingCodes(
        rows
          .map((row) => {
            const code = Object.values(row)[0];
            return typeof code === "string" ? code : null;
          })
          .filter((code): code is string => code !== null && !/^DEL(?:\d+|-)/i.test(code)),
      );
    };
    void loadCodes();
  }, [watchPuskesmasId]);

  /* Auto-compute suggested username & password */
  const selectedPusk = useMemo(
    () => puskList.find((p) => p.id === watchPuskesmasId),
    [puskList, watchPuskesmasId],
  );

  /* Calculate last code and next code correctly handling gaps */
  const codeInfo = useMemo(() => {
    if (!selectedPusk) return null;
    const kode = selectedPusk.kode?.toUpperCase() || "PKM";

    const nums: number[] = [];
    for (const code of existingCodes) {
      if (!code) continue;
      const parts = code.split("-");
      const numStr = parts[parts.length - 1];
      const n = parseInt(numStr, 10);
      if (!isNaN(n)) nums.push(n);
    }

    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;

    let nextNum = 1;
    for (let i = 1; i <= maxNum + 1; i++) {
      if (!nums.includes(i)) {
        nextNum = i;
        break;
      }
    }

    const lastCode = maxNum > 0 ? `${kode}-${String(maxNum).padStart(4, "0")}` : null;
    const nextCode = `${kode}-${String(nextNum).padStart(4, "0")}`;
    const isGapFilling = nextNum <= maxNum;

    return { lastCode, nextCode, isGapFilling };
  }, [selectedPusk, existingCodes]);

  const keluargaCount = existingCodes.length;

  const suggestedUsername = useMemo(() => {
    if (!selectedPusk || !codeInfo) return "";
    const seq = codeInfo.nextCode.split("-").pop() || "0001";
    const kode = selectedPusk.kode?.toUpperCase() || "PKM";
    return `${seq}Keluarga${kode}`;
  }, [selectedPusk, codeInfo]);

  const suggestedPassword = useMemo(() => {
    if (!watchKepala || watchKepala.trim().length < 2) return "";
    const base = toTitleCaseNoSpace(watchKepala);
    return base.length < 6 ? `${base}123` : base;
  }, [watchKepala]);

  /* Sync suggestions into form */
  useEffect(() => {
    if (suggestedUsername) form.setValue("username", suggestedUsername);
  }, [suggestedUsername, form]);

  useEffect(() => {
    if (watchKepala) form.setValue("full_name", watchKepala);
  }, [watchKepala, form]);

  /* Copy to clipboard helper for success dialog */
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  /* ---------- Submit ---------- */
  const onSubmit = async (values: TambahKeluargaValues) => {
    setSubmitting(true);
    try {
      // Map the lower phone to the main telepon field
      const payload = {
        ...values,
        telepon: values.phone || "",
      };
      const result = await createKeluarga(payload);
      toast.success("Keluarga berhasil ditambahkan beserta akun pengguna.");
      setSuccessData({
        keluarga: (result as any).keluarga?.kepala_keluarga ?? values.kepala_keluarga,
        username: (result as any).username ?? values.username ?? suggestedUsername,
        password: (result as any).password ?? values.password ?? suggestedPassword,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan keluarga";
      if (message.toLowerCase().includes("nomor kk"))
        form.setError("nomor_kk", { type: "server", message });
      if (message.toLowerCase().includes("nik")) form.setError("nik", { type: "server", message });
      if (message.toLowerCase().includes("username"))
        form.setError("username", { type: "server", message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isDinkes = role === ROLES.ADMIN_DINKES;

  // Standard input height and default borders
  const inputKuning = "h-12 text-base";
  const inputBiru = "h-12 text-base";
  const inputHijau = "h-12 text-base";
  const textareaHijau = "text-base";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tambah Keluarga"
        description="Lengkapi data keluarga binaan sesuai Kartu Keluarga. Data masuk Log dan dapat didaftarkan setelah diverifikasi."
        actions={
          <Button variant="outline" onClick={() => router.push("/keluarga/log")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
        }
      />

      {/* ---- Card: Data Keluarga & Akun Pengguna ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Data Keluarga</CardTitle>
          <CardDescription>Pastikan NIK dan Nomor KK terisi 16 digit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Predicted Kode Keluarga */}
              {isDinkes && !watchPuskesmasId ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Kode Keluarga (otomatis)</p>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Pilih Puskesmas terlebih dahulu
                    </p>
                  </div>
                </div>
              ) : (
                codeInfo && (
                  <div className="flex flex-col md:flex-row gap-4 md:items-center rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Hash className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Kode Keluarga Terakhir</p>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {codeInfo.lastCode || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <Hash className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {codeInfo.isGapFilling
                            ? "Kode Keluarga Yang Dihapus Terakhir (Akan Dipakai)"
                            : "Kode Keluarga Berikutnya"}
                        </p>
                        <p className="font-mono text-sm font-semibold text-primary">
                          {codeInfo.nextCode}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Row 1 (Biru & Kuning): Nomor KK, NIK, Kepala Keluarga */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  name="nomor_kk"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nomor KK <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          maxLength={16}
                          placeholder="16 digit angka"
                          className={inputKuning}
                          {...field}
                        />
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
                      <FormLabel>
                        NIK Kepala Keluarga <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          maxLength={16}
                          placeholder="16 digit angka"
                          className={inputKuning}
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
                      <FormLabel>
                        Kepala Keluarga <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Nama lengkap" className={inputBiru} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Row 2 (Hijau 1): Alamat */}
              <div className="grid grid-cols-1">
                <FormField
                  name="alamat"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Alamat lengkap (opsional)"
                          className={textareaHijau}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Row 3 (Hijau 2 & Hijau 3): Puskesmas (Dinkes Only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isDinkes ? (
                  <FormField
                    name="puskesmas_id"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Puskesmas <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className={inputHijau}>
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
                ) : (
                  <div className="hidden md:block" />
                )}
              </div>

              {/* ---- Section 2: Akun Pengguna Keluarga ---- */}
              <div className="border-t pt-6">
                <div className="mb-4">
                  <h3 className="text-base font-semibold">Akun Pengguna Keluarga</h3>
                  <p className="text-sm text-muted-foreground">
                    Akun login dibuat untuk keluarga. Sesuaikan Identitas yang dibutuhkan
                  </p>
                </div>
                <div className="space-y-4">
                  {/* Row: Username & Password */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      name="username"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Username <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Username"
                              className="h-12 text-base"
                              autoComplete="new-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="password"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Password <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                className="h-12 text-base pr-10"
                                autoComplete="new-password"
                                {...field}
                              />
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? "Sembunyikan" : "Tampilkan"}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-5 w-5" />
                                ) : (
                                  <Eye className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row: Nama Lengkap */}
                  <FormField
                    name="full_name"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Nama Lengkap <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nama lengkap keluarga"
                            className="h-12 text-base"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Row: Email & Telepon */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      name="email"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Email (opsional)"
                              className="h-12 text-base"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="phone"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telepon</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Nomor telepon (opsional)"
                              className="h-12 text-base"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* ---- Submit ---- */}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => router.push("/keluarga/log")}>
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Keluarga
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ---- Success Dialog showing credentials ---- */}
      <Dialog
        open={!!successData}
        onOpenChange={(open) => {
          if (!open) {
            setSuccessData(null);
            router.push("/keluarga/log");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keluarga &amp; Akun Berhasil Dibuat</DialogTitle>
            <DialogDescription>
              Berikut data login untuk keluarga <strong>{successData?.keluarga}</strong>. Catat atau
              salin sebelum menutup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">Username</p>
                <p className="font-mono text-sm font-medium">{successData?.username}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(successData?.username ?? "", "dlg-user")}
                className="text-muted-foreground hover:text-foreground"
              >
                {copiedField === "dlg-user" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">Password</p>
                <p className="font-mono text-sm font-medium">{successData?.password}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(successData?.password ?? "", "dlg-pass")}
                className="text-muted-foreground hover:text-foreground"
              >
                {copiedField === "dlg-pass" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setSuccessData(null);
                router.push("/keluarga/log");
              }}
            >
              Tutup &amp; Kembali ke Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
