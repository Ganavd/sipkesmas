"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Edit3, Printer, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ROLES } from "@/lib/constants/roles";
import { useRole } from "@/hooks/use-role";
import { askepService, type AskepRow, type AskepUpdatePayload } from "@/services/askep.service";
import { AskepDocument } from "../components/askep-document";

interface Props {
  id: string;
}

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoFromInput(value: string) {
  return new Date(value).toISOString();
}

function createForm(item: AskepRow): AskepUpdatePayload {
  return {
    tanggal: toInputDateTime(item.tanggal),
    pengkajian: item.pengkajian ?? "",
    diagnosis: item.diagnosis ?? "",
    rencana_intervensi: item.rencana_intervensi ?? "",
    implementasi: item.implementasi ?? "",
    evaluasi_s: item.evaluasi_s ?? "",
    evaluasi_o: item.evaluasi_o ?? "",
    evaluasi_a: item.evaluasi_a ?? "",
    evaluasi_p: item.evaluasi_p ?? "",
  };
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function AskepDetailView({ id }: Props) {
  const { role } = useRole();
  const [item, setItem] = useState<AskepRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<AskepUpdatePayload | null>(null);

  const canEdit = role === ROLES.ADMIN_DINKES || role === ROLES.ADMIN_PUSKESMAS || role === ROLES.PERAWAT;

  const load = async () => {
    setLoading(true);
    try {
      const data = await askepService.getById(id);
      setItem(data);
      setForm(data ? createForm(data) : null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat detail Askep");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const updateForm = (field: keyof AskepUpdatePayload, value: string) => {
    setForm((current) => current ? { ...current, [field]: value } : current);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    const required: Array<keyof AskepUpdatePayload> = [
      "tanggal",
      "pengkajian",
      "diagnosis",
      "rencana_intervensi",
      "implementasi",
    ];
    const missing = required.some((field) => !String(form[field] ?? "").trim());
    if (missing) {
      toast.error("Tanggal, pengkajian, diagnosis, rencana intervensi, dan implementasi wajib diisi");
      return;
    }

    setSaving(true);
    try {
      await askepService.update(id, {
        ...form,
        tanggal: toIsoFromInput(form.tanggal),
      });
      toast.success("Asuhan Keperawatan berhasil diperbarui");
      setEditing(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan Askep");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[720px] w-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <EmptyState
        title="Asuhan Keperawatan tidak ditemukan"
        description="Data mungkin sudah dihapus atau tidak tersedia untuk akun ini."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Detail Asuhan Keperawatan"
          description={role === ROLES.KELUARGA ? "Mode lihat saja untuk akun keluarga." : "Lembar Askep dapat dilihat, diedit, dan dicetak."}
          actions={
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/askep">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Kembali
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Cetak
              </Button>
              {canEdit && !editing && (
                <Button size="sm" onClick={() => setEditing(true)}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
            </>
          }
        />
      </div>

      {editing && form ? (
        <form onSubmit={handleSave} className="print:hidden rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Tanggal dan Jam Askep">
              <Input
                type="datetime-local"
                value={form.tanggal}
                onChange={(event) => updateForm("tanggal", event.target.value)}
                required
              />
            </FormField>
            <FormField label="Diagnosis Keperawatan">
              <Textarea
                className="min-h-28"
                value={form.diagnosis}
                onChange={(event) => updateForm("diagnosis", event.target.value)}
                required
              />
            </FormField>
            <FormField label="Pengkajian">
              <Textarea
                className="min-h-36"
                value={form.pengkajian}
                onChange={(event) => updateForm("pengkajian", event.target.value)}
                required
              />
            </FormField>
            <FormField label="Rencana Intervensi">
              <Textarea
                className="min-h-36"
                value={form.rencana_intervensi}
                onChange={(event) => updateForm("rencana_intervensi", event.target.value)}
                required
              />
            </FormField>
            <FormField label="Implementasi">
              <Textarea
                className="min-h-36"
                value={form.implementasi}
                onChange={(event) => updateForm("implementasi", event.target.value)}
                required
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Evaluasi S">
                <Textarea value={form.evaluasi_s} onChange={(event) => updateForm("evaluasi_s", event.target.value)} />
              </FormField>
              <FormField label="Evaluasi O">
                <Textarea value={form.evaluasi_o} onChange={(event) => updateForm("evaluasi_o", event.target.value)} />
              </FormField>
              <FormField label="Evaluasi A">
                <Textarea value={form.evaluasi_a} onChange={(event) => updateForm("evaluasi_a", event.target.value)} />
              </FormField>
              <FormField label="Evaluasi P">
                <Textarea value={form.evaluasi_p} onChange={(event) => updateForm("evaluasi_p", event.target.value)} />
              </FormField>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setForm(createForm(item));
              }}
              disabled={saving}
            >
              <X className="mr-2 h-4 w-4" />
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mx-auto max-w-[794px] print:max-w-none">
        <AskepDocument item={item} />
      </div>
    </div>
  );
}
