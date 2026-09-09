"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { updateKeluargaUserInfo, updateKeluargaPassword } from "@/actions/keluarga";
import { supabase } from "@/src/integrations/supabase/client";

const userInfoSchema = z.object({
  username: z.string().min(3, "Minimal 3 karakter"),
  full_name: z.string().min(3, "Minimal 3 karakter"),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

const passwordSchema = z.object({
  old_password: z.string().min(6, "Password lama minimal 6 karakter"),
  new_password: z.string().min(6, "Password baru minimal 6 karakter"),
});

export function KeluargaAuthEditForm({ keluargaId }: { keluargaId: string }) {
  const [submittingInfo, setSubmittingInfo] = useState(false);
  const [submittingPass, setSubmittingPass] = useState(false);
  const [loading, setLoading] = useState(true);

  const infoForm = useForm<z.infer<typeof userInfoSchema>>({
    resolver: zodResolver(userInfoSchema),
    defaultValues: { username: "", full_name: "", email: "", phone: "" },
  });

  const passForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { old_password: "", new_password: "" },
  });

  useEffect(() => {
    supabase
      .from("keluarga")
      .select("user_id")
      .eq("id", keluargaId)
      .single()
      .then(({ data: k }) => {
        if (k?.user_id) {
          supabase
            .from("profiles")
            .select("username, full_name, email, phone")
            .eq("id", k.user_id)
            .single()
            .then(({ data: prof }) => {
              if (prof) {
                infoForm.reset({
                  username: prof.username || "",
                  full_name: prof.full_name || "",
                  email: prof.email || "",
                  phone: prof.phone || "",
                });
              }
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      });
  }, [keluargaId, infoForm]);

  const onInfoSubmit = async (values: z.infer<typeof userInfoSchema>) => {
    setSubmittingInfo(true);
    try {
      await updateKeluargaUserInfo({ keluarga_id: keluargaId, ...values });
      toast.success("Informasi akun berhasil diperbarui");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memperbarui info akun";
      if (message.toLowerCase().includes("username")) {
        infoForm.setError("username", { type: "server", message });
      }
      toast.error(message);
    } finally {
      setSubmittingInfo(false);
    }
  };

  const onPassSubmit = async (values: z.infer<typeof passwordSchema>) => {
    setSubmittingPass(true);
    try {
      await updateKeluargaPassword({
        keluarga_id: keluargaId,
        old_password: values.old_password,
        new_password: values.new_password,
      });
      toast.success("Password berhasil diperbarui");
      passForm.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui password");
    } finally {
      setSubmittingPass(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Akun User</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...infoForm}>
            <form onSubmit={infoForm.handleSubmit(onInfoSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  name="username"
                  control={infoForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Username <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="full_name"
                  control={infoForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nama Lengkap <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="email"
                  control={infoForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="phone"
                  control={infoForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. Telepon</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={submittingInfo}>
                  {submittingInfo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ubah Data User
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ganti Password</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...passForm}>
            <form onSubmit={passForm.handleSubmit(onPassSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  name="old_password"
                  control={passForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Password Lama <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Masukkan password saat ini"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="new_password"
                  control={passForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Password Baru <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Minimal 6 karakter" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={submittingPass}>
                  {submittingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ganti Password
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
