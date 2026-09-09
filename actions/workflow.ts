"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit } from "@/src/lib/audit.server";

async function checkAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized: Silakan masuk terlebih dahulu");
  }
  return { supabase, user, userId: user.id };
}

const entitySchema = z.enum(["keluarga", "kunjungan"]);

async function getActorRole(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

function unpack(rawData: any) {
  return rawData && typeof rawData === "object" && "data" in rawData ? rawData.data : rawData;
}

export async function registerEntity(rawData: { entity: "keluarga" | "kunjungan"; id: string; note?: string }) {
  const { supabase, userId } = await checkAuth();
  const data = z.object({
    entity: entitySchema,
    id: z.string().uuid(),
    note: z.string().trim().max(2000).optional().default(""),
  }).parse(unpack(rawData));

  // Rencana baru (lihat sipkesmas-rencana-revisi.md bagian 6.2): kunjungan
  // cuma bisa didaftarkan resmi oleh Keluarga sendiri lewat ajukanResmiKunjungan(),
  // bukan lagi lewat aksi generik staff ini.
  if (data.entity === "kunjungan") {
    throw new Error(
      "Kunjungan tidak lagi didaftarkan lewat aksi ini. Pakai ajukanResmiKunjungan() — hanya Keluarga yang bisa mengajukan resmi.",
    );
  }

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
 * Keluarga mengajukan resmi jadwal kunjungan (status: draft -> terdaftar).
 * Satu-satunya jalan is_registered kunjungan berubah — dieksekusi lewat RPC
 * kunjungan_ajukan_resmi (SECURITY DEFINER) yang sudah divalidasi di database:
 * cuma role keluarga, cuma untuk kunjungan miliknya sendiri, cuma sekali.
 * Lihat supabase/migrations/20260716120000_fase1_tindakan_asuhan_keperawatan_maps.sql
 * bagian 9.
 */
export async function ajukanResmiKunjungan(rawData: { id: string }) {
  const { supabase, userId } = await checkAuth();
  const data = z.object({ id: z.string().uuid() }).parse(unpack(rawData));

  const { error } = await supabase.rpc("kunjungan_ajukan_resmi", {
    _kunjungan_id: data.id,
  });

  if (error) {
    // Pesan dari RAISE EXCEPTION di database sudah dalam Bahasa Indonesia
    // dan aman ditampilkan langsung ke pengguna (lihat migrasi bagian 9).
    throw new Error(error.message);
  }

  const { data: row, error: fetchError } = await supabase
    .from("kunjungan")
    .select("*")
    .eq("id", data.id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  return { row };
}

export async function overrideRegisteredEntity(rawData: { entity: "keluarga" | "kunjungan"; id: string; patch?: Record<string, unknown>; note: string }) {
  const { userId } = await checkAuth();
  const data = z.object({
    entity: entitySchema,
    id: z.string().uuid(),
    patch: z.record(z.string(), z.unknown()).optional().default({}),
    note: z.string().trim().min(3, "Alasan override wajib diisi").max(2000),
  }).parse(unpack(rawData));

  const role = await getActorRole(userId);
  if (role !== "admin_dinkes") {
    throw new Error("Hanya Admin Dinkes yang dapat melakukan override data terdaftar.");
  }

  // Rencana baru: kunjungan tidak lagi punya konsep "override" — Admin
  // Puskesmas/Dinkes tetap punya akses Edit/Hapus langsung di Daftar Kunjungan
  // sampai tindakan = 'selesai' (lihat trigger kunjungan_block_when_registered
  // di migrasi fase 1), jadi tidak perlu jalur override terpisah lagi.
  if (data.entity === "kunjungan") {
    throw new Error(
      "Kunjungan tidak lagi pakai mekanisme override. Edit langsung lewat halaman Daftar Kunjungan (masih diizinkan sampai tindakan Selesai).",
    );
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

export async function runAutoRegisterNow() {
  const { userId } = await checkAuth();
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
