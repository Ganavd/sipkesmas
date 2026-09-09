"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit } from "@/lib/audit.server";

// Helper untuk Admin Client (Bypass RLS)
function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di .env");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Skema Validasi Zod (Internal file, tanpa keyword 'export')
const submitTindakLanjut1Schema = z.object({
  id: z.string().uuid(),
  tim_ids: z.array(z.string().uuid()),
  mobil: z.array(z.string()),
  catatan: z.string().optional(),
});

const submitTindakLanjut2Schema = z.object({
  kunjungan_id: z.string().uuid(),
  askep_rows: z.array(
    z.object({
      tanggal: z.string(),
      pengkajian: z.string(),
      diagnosis: z.string(),
      intervensi: z.string(),
      implementasi: z.string(),
      evaluasi_s: z.string(),
      evaluasi_o: z.string(),
      evaluasi_a: z.string(),
      evaluasi_p: z.string(),
      petugas: z.string().uuid(),
    })
  ),
});

export type SubmitTindakLanjut1Input = z.infer<typeof submitTindakLanjut1Schema>;
export type SubmitTindakLanjut2Input = z.infer<typeof submitTindakLanjut2Schema>;

/**
 * Server Action: Submit Tindak Lanjut 1
 */
export async function submitTindakLanjut1(input: SubmitTindakLanjut1Input) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = submitTindakLanjut1Schema.parse(input);

  const supabaseAdmin = getAdminClient();

  const { data: existingKunjungan, error: fetchErr } = await supabaseAdmin
    .from("kunjungan")
    .select("kunjungan_code, puskesmas_id")
    .eq("id", data.id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  let realKunjunganCode = existingKunjungan.kunjungan_code;
  if (realKunjunganCode && realKunjunganCode.startsWith("DRAFT-")) {
    const { generateGaplessCode } = await import("@/lib/gapless-code");
    realKunjunganCode = await generateGaplessCode(supabaseAdmin, "kunjungan", "kunjungan_code", existingKunjungan.puskesmas_id);
  }

  // Update status kunjungan menggunakan Admin Client agar tidak terhalang RLS
  const { data: row, error } = await supabaseAdmin
    .from("kunjungan")
    .update({
      tl1_mobil: data.mobil,
      tl1_catatan: data.catatan || null,
      tindakan: "proses",
      kunjungan_code: realKunjunganCode,
      updated_by: userId,
    })
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // Insert tim kunjungan
  if (data.tim_ids.length > 0) {
    await supabase.from("kunjungan_tim").delete().eq("kunjungan_id", data.id);

    const timInserts = data.tim_ids.map((timId) => ({
      kunjungan_id: data.id,
      perawat_id: timId,
    }));

    const { error: timErr } = await supabase.from("kunjungan_tim").insert(timInserts);
    if (timErr) throw new Error(timErr.message);
  }

  await writeAudit({
    actorId: userId,
    action: "tindak_lanjut_1",
    entity: "kunjungan",
    entityId: row.id,
    puskesmasId: row.puskesmas_id,
    description: `Mensubmit Tindak Lanjut 1 untuk kunjungan ${row.kunjungan_code}.`,
    metadata: { mobil: data.mobil, tim_count: data.tim_ids.length },
  });

  return { kunjungan: row };
}

/**
 * Server Action: Submit Tindak Lanjut 2
 */
export async function submitTindakLanjut2(input: SubmitTindakLanjut2Input) {
  const { supabase, userId } = await requireSupabaseAuth();
  const data = submitTindakLanjut2Schema.parse(input);

  // 1. Ambil data kunjungan
  const { data: kunjungan, error: kErr } = await supabase
    .from("kunjungan")
    .select("puskesmas_id, kunjungan_code")
    .eq("id", data.kunjungan_id)
    .single();

  if (kErr || !kunjungan) throw new Error("Kunjungan tidak ditemukan");

  // 2. Insert Asuhan Keperawatan
  if (data.askep_rows.length > 0) {
    const askepInserts = data.askep_rows.map((row) => ({
      kunjungan_id: data.kunjungan_id,
      puskesmas_id: kunjungan.puskesmas_id,
      tanggal: new Date(row.tanggal).toISOString(),
      pengkajian: row.pengkajian,
      diagnosis: row.diagnosis,
      rencana_intervensi: row.intervensi,
      implementasi: row.implementasi,
      evaluasi_s: row.evaluasi_s,
      evaluasi_o: row.evaluasi_o,
      evaluasi_a: row.evaluasi_a,
      evaluasi_p: row.evaluasi_p,
      petugas_id: row.petugas,
    }));

    const { error: askepErr } = await supabase.from("asuhan_keperawatan").insert(askepInserts);
    if (askepErr) throw new Error(askepErr.message);
  }

  // 3. Update status kunjungan ke 'selesai' menggunakan Admin Client (Bypass RLS trigger)
  const supabaseAdmin = getAdminClient();

  const { error: updateErr } = await supabaseAdmin
    .from("kunjungan")
    .update({ tindakan: "selesai", updated_by: userId })
    .eq("id", data.kunjungan_id);

  if (updateErr) throw new Error(updateErr.message);

  await writeAudit({
    actorId: userId,
    action: "tindak_lanjut_2",
    entity: "kunjungan",
    entityId: data.kunjungan_id,
    puskesmasId: kunjungan.puskesmas_id,
    description: `Mencatat Asuhan Keperawatan untuk kunjungan ${kunjungan.kunjungan_code}.`,
    metadata: { row_count: data.askep_rows.length },
  });

  return { ok: true };
}

/**
 * Server Action: Hapus / Revert Tindak Lanjut 1
 */
export async function revertTindakLanjut1(kunjunganId: string) {
  const { supabase, userId } = await requireSupabaseAuth();
  const supabaseAdmin = getAdminClient();

  // 1. Ambil data kunjungan
  const { data: kunjungan, error: kErr } = await supabaseAdmin
    .from("kunjungan")
    .select("puskesmas_id, kunjungan_code")
    .eq("id", kunjunganId)
    .single();

  if (kErr || !kunjungan) throw new Error("Kunjungan tidak ditemukan");

  // 2. Hapus tim kunjungan
  await supabaseAdmin.from("kunjungan_tim").delete().eq("kunjungan_id", kunjunganId);

  // 3. Revert status ke 'pengajuan' dan kosongkan data TL1
  const { error: updateErr } = await supabaseAdmin
    .from("kunjungan")
    .update({ 
      tindakan: "pengajuan", 
      tl1_mobil: null,
      tl1_catatan: null,
      updated_by: userId 
    })
    .eq("id", kunjunganId);

  if (updateErr) throw new Error(updateErr.message);

  await writeAudit({
    actorId: userId,
    action: "hapus_tindak_lanjut_1",
    entity: "kunjungan",
    entityId: kunjunganId,
    puskesmasId: kunjungan.puskesmas_id,
    description: `Menghapus data Tindak Lanjut 1 untuk kunjungan ${kunjungan.kunjungan_code}. Status kembali ke pengajuan.`,
  });

  return { ok: true };
}