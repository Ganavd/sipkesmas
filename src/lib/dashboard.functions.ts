/**
 * Dashboard — server functions. Statistik scope-aware berdasarkan role pemanggil.
 */
"use server";

import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enrichAuditItems } from "@/lib/audit.server";

async function getRole(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

async function getPuskesmasId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("puskesmas_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.puskesmas_id ?? null;
}

export async function getDashboardStats() {
  const { userId } = await requireSupabaseAuth();
    const role = await getRole(userId);
    const puskesmasId = await getPuskesmasId(userId);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    if (role === "admin_dinkes") {
      const [pusk, users, keluarga, kunjungan, aktifToday, draftPending, regKelToday, regKunToday] = await Promise.all([
        supabaseAdmin.from("puskesmas").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabaseAdmin.from("keluarga").select("id", { count: "exact", head: true }).eq("status", "aktif").is("deleted_at", null),
        supabaseAdmin.from("kunjungan").select("id, keluarga!inner(status, deleted_at)", { count: "exact", head: true }).eq("keluarga.status", "aktif").is("keluarga.deleted_at", null).is("deleted_at", null),
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null).gte("last_activity_at", todayISO),
        supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("is_registered", false).eq("tindakan", "pengajuan").is("deleted_at", null),
        supabaseAdmin.from("keluarga").select("id", { count: "exact", head: true }).eq("is_registered", true).eq("status", "aktif").gte("registered_at", todayISO).is("deleted_at", null),
        supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("is_registered", true).gte("registered_at", todayISO).is("deleted_at", null),
      ]);
      return {
        role,
        scope: "dinkes",
        totalPuskesmas: pusk.count ?? 0,
        totalPengguna: users.count ?? 0,
        totalKeluarga: keluarga.count ?? 0,
        totalKunjungan: kunjungan.count ?? 0,
        userAktifHariIni: aktifToday.count ?? 0,
        draftPending: draftPending.count ?? 0,
        registeredHariIni: (regKelToday.count ?? 0) + (regKunToday.count ?? 0),
      };
    }

    if ((role === "admin_puskesmas" || role === "perawat") && puskesmasId) {
      const [keluarga, kunjungan, perawat, aktifToday, draftPending, regKelToday, regKunToday] = await Promise.all([
        supabaseAdmin.from("keluarga").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("status", "aktif").is("deleted_at", null),
        supabaseAdmin.from("kunjungan").select("id, keluarga!inner(status, deleted_at)", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("keluarga.status", "aktif").is("keluarga.deleted_at", null).is("deleted_at", null),
        supabaseAdmin.rpc("count_perawat_in_puskesmas", { _puskesmas_id: puskesmasId }),
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_active", true).is("deleted_at", null).gte("last_activity_at", todayISO),
        supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_registered", false).eq("tindakan", "pengajuan").is("deleted_at", null),
        supabaseAdmin.from("keluarga").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_registered", true).eq("status", "aktif").gte("registered_at", todayISO).is("deleted_at", null),
        supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_registered", true).gte("registered_at", todayISO).is("deleted_at", null),
      ]);
      return {
        role,
        scope: "puskesmas",
        totalKeluarga: keluarga.count ?? 0,
        totalKunjungan: kunjungan.count ?? 0,
        totalPerawat: (perawat.data as number | null) ?? 0,
        userAktifHariIni: aktifToday.count ?? 0,
        draftPending: draftPending.count ?? 0,
        registeredHariIni: (regKelToday.count ?? 0) + (regKunToday.count ?? 0),
      };
    }

    // keluarga (warga)
    const { data: family } = await supabaseAdmin
      .from("keluarga")
      .select("id, status")
      .eq("user_id", userId)
      .eq("status", "aktif")
      .is("deleted_at", null)
      .maybeSingle();
    const [kel, kunjungan] = await Promise.all([
      supabaseAdmin.from("keluarga").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "aktif").is("deleted_at", null),
      family
        ? supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("keluarga_id", family.id).is("deleted_at", null)
        : Promise.resolve({ count: 0 }),
    ]);
    return {
      role,
      scope: "keluarga",
      totalKeluarga: kel.count ?? 0,
      totalKunjungan: kunjungan.count ?? 0,
      draftPending: 0,
      registeredHariIni: 0,
    };
}

export async function getDashboardActivity() {
  const { userId } = await requireSupabaseAuth();
  const role = await getRole(userId);
  const puskesmasId = await getPuskesmasId(userId);

  // Keep dashboard activity low-footprint: the page only needs a compact,
  // first-load slice of audit and recent tables, not the full feed.
  let auditQ = supabaseAdmin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(4);
  let kunjunganQ = supabaseAdmin
    .from("kunjungan")
    .select("id, kunjungan_code, status, is_registered, jenis_kunjungan, tanggal_kunjungan, keluarga_id, keluarga!inner(status, deleted_at)")
    .eq("keluarga.status", "aktif")
    .is("keluarga.deleted_at", null)
    .is("deleted_at", null)
    .order("tanggal_kunjungan", { ascending: false })
    .limit(3);
  let keluargaQ = supabaseAdmin
    .from("keluarga")
    .select("id, keluarga_code, kepala_keluarga, is_registered, created_at")
    .eq("status", "aktif")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(3);

    if (role !== "admin_dinkes" && puskesmasId) {
      auditQ = auditQ.eq("puskesmas_id", puskesmasId);
      kunjunganQ = kunjunganQ.eq("puskesmas_id", puskesmasId);
      keluargaQ = keluargaQ.eq("puskesmas_id", puskesmasId);
    }
    if (role === "keluarga") {
      auditQ = supabaseAdmin
        .from("audit_logs")
        .select("*")
        .eq("actor_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      keluargaQ = supabaseAdmin
        .from("keluarga")
        .select("id, keluarga_code, kepala_keluarga, is_registered, created_at")
        .eq("user_id", userId)
        .eq("status", "aktif")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
    }

    const [{ data: audit }, { data: kunjunganWithFamily }, { data: keluarga }] = await Promise.all([auditQ, kunjunganQ, keluargaQ]);
    const kunjungan = (kunjunganWithFamily ?? []).map((visit) => {
      const { keluarga: _family, ...row } = visit;
      return row;
    });

    // Enrich kunjungan with keluarga name
    const keluargaIds = Array.from(new Set((kunjungan ?? []).map((k) => k.keluarga_id)));
    let kelMap = new Map<string, string>();
    if (keluargaIds.length) {
      const { data: kel } = await supabaseAdmin
        .from("keluarga")
        .select("id, kepala_keluarga")
        .in("id", keluargaIds);
      kelMap = new Map((kel ?? []).map((k) => [k.id, k.kepala_keluarga]));
    }

    const enriched = await enrichAuditItems(audit ?? []);

    return {
      auditLogs: enriched,
      kunjunganTerbaru: (kunjungan ?? []).map((k) => ({
        ...k,
        keluarga_nama: kelMap.get(k.keluarga_id) ?? null,
      })),
      keluargaTerbaru: keluarga ?? [],
  };
}