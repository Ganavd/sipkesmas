/**
 * Workflow lifecycle server functions — register / override / auto-register.
 * Berlaku untuk keluarga & kunjungan.
 */
"use server";

import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit } from "@/lib/audit.server";

const entitySchema = z.enum(["keluarga", "kunjungan"]);

async function getActorRole(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

/**
 * Tandai entity sebagai resmi terdaftar (draft → registered).
 * Hanya admin_puskesmas/perawat dalam scope, atau admin_dinkes.
 */
const registerEntitySchema = z.object({
  entity: entitySchema,
  id: z.string().uuid(),
  note: z.string().trim().max(2000).optional().default(""),
});

type RegisterEntityInput = z.infer<typeof registerEntitySchema>;

export async function registerEntity(input: RegisterEntityInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = registerEntitySchema.parse(input);
  const table = data.entity;
    const { data: row, error } = await supabase
      .from(table)
      .update({
        is_registered: true,
        workflow_status: "registered",
        registered_at: new Date().toISOString(),
        registered_by: userId,
        ...(data.note ? { workflow_note: data.note } : {}),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: userId,
      action: "register",
      entity: table,
      entityId: row.id,
      puskesmasId: (row as { puskesmas_id?: string }).puskesmas_id ?? null,
      description: `Mendaftarkan ${table} ke daftar resmi.`,
      metadata: { note: data.note ?? "" },
    });
  return { row };
}

/**
 * Override entity yang sudah registered (hanya admin_dinkes).
 * Wajib menyertakan workflow_note (alasan).
 */
const overrideRegisteredEntitySchema = z.object({
  entity: entitySchema,
  id: z.string().uuid(),
  patch: z.record(z.string(), z.unknown()).optional().default({}),
  note: z.string().trim().min(3, "Alasan override wajib diisi").max(2000),
});

type OverrideRegisteredEntityInput = z.infer<typeof overrideRegisteredEntitySchema>;

export async function overrideRegisteredEntity(input: OverrideRegisteredEntityInput) {
  const { userId } = await requireSupabaseAuth();
  const data = overrideRegisteredEntitySchema.parse(input);
    const role = await getActorRole(userId);
    if (role !== "admin_dinkes") {
      throw new Error("Hanya Admin Dinkes yang dapat melakukan override data terdaftar.");
    }
    const { data: row, error } = await supabaseAdmin
      .from(data.entity)
      .update({
        ...(data.patch as Record<string, unknown>),
        workflow_note: data.note,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: userId,
      action: "override",
      entity: data.entity,
      entityId: row.id,
      puskesmasId: (row as { puskesmas_id?: string }).puskesmas_id ?? null,
      description: `Override data ${data.entity} terdaftar.`,
      metadata: { note: data.note, patch: data.patch },
    });
  return { row };
}

/**
 * Jalankan auto-register draft expired (manual trigger; admin_dinkes only).
 */
export async function runAutoRegisterNow() {
  const { userId } = await requireSupabaseAuth();
    const role = await getActorRole(userId);
    if (role !== "admin_dinkes") {
      throw new Error("Hanya Admin Dinkes yang dapat menjalankan auto-register.");
    }
    const { data, error } = await supabaseAdmin.rpc("auto_register_expired_drafts");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    await writeAudit({
      actorId: userId,
      action: "auto_register",
      entity: "system",
      description: `Auto-register draft expired dijalankan manual.`,
      metadata: row as Record<string, unknown>,
    });
  return { keluarga: row?.keluarga_count ?? 0, kunjungan: row?.kunjungan_count ?? 0 };
}

const ajukanResmiKunjunganSchema = z.object({ id: z.string().uuid() });

type AjukanResmiKunjunganInput = z.infer<typeof ajukanResmiKunjunganSchema>;

export async function ajukanResmiKunjungan(input: AjukanResmiKunjunganInput) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = ajukanResmiKunjunganSchema.parse(input);

  const { error } = await supabase.rpc("kunjungan_ajukan_resmi", {
    _kunjungan_id: data.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: row, error: fetchError } = await supabase
    .from("kunjungan")
    .select("*")
    .eq("id", data.id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  await writeAudit({
    actorId: userId,
    action: "register",
    entity: "kunjungan",
    entityId: row.id,
    puskesmasId: (row as { puskesmas_id?: string }).puskesmas_id ?? null,
    description: `Mengajukan resmi kunjungan ${row.kunjungan_code ?? data.id}.`,
    metadata: { kunjungan_id: data.id },
  });

  return { row };
}