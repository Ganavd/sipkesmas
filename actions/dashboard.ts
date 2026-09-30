"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enrichAuditItems } from "@/src/lib/audit.server";

// Helper to check authentication and return client + user info
async function checkAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized: Silakan masuk terlebih dahulu");
  }
  return { supabase, user, userId: user.id };
}

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

export interface DashboardDateRange {
  startDate?: string;
  endDate?: string;
}

export async function getDashboardStats(dateRange?: DashboardDateRange) {
  const { userId } = await checkAuth();
  const role = await getRole(userId);
  const puskesmasId = await getPuskesmasId(userId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  let startISO: string | undefined;
  let endISO: string | undefined;

  if (dateRange?.startDate) {
    const s = new Date(dateRange.startDate);
    s.setHours(0, 0, 0, 0);
    startISO = s.toISOString();
  }
  if (dateRange?.endDate) {
    const e = new Date(dateRange.endDate);
    e.setHours(23, 59, 59, 999);
    endISO = e.toISOString();
  }

  const buildKunjunganQuery = (baseQuery: any) => {
    let q = baseQuery;
    if (startISO) q = q.gte("tanggal_kunjungan", startISO);
    if (endISO) q = q.lte("tanggal_kunjungan", endISO);
    return q;
  };

  if (role === "admin_dinkes") {
    const [pusk, users, keluarga, kunjungan, belumKel, belumKapus, proses, selesai, aktifToday, draftPending, regKelToday, regKunToday] = await Promise.all([
      supabaseAdmin.from("puskesmas").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabaseAdmin.from("keluarga").select("id", { count: "exact", head: true }).is("deleted_at", null),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).is("deleted_at", null)),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("is_registered", false).is("deleted_at", null)),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("is_registered", true).eq("tindakan", "pengajuan").is("deleted_at", null)),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("is_registered", true).in("tindakan", ["disetujui", "proses"]).is("deleted_at", null)),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("tindakan", "selesai").is("deleted_at", null)),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("last_activity_at", todayISO),
      supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("is_registered", false).eq("tindakan", "pengajuan").is("deleted_at", null),
      supabaseAdmin.from("keluarga").select("id", { count: "exact", head: true }).eq("is_registered", true).gte("registered_at", todayISO),
      supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("is_registered", true).gte("registered_at", todayISO),
    ]);
    return {
      role,
      scope: "dinkes",
      totalPuskesmas: pusk.count ?? 0,
      totalPengguna: users.count ?? 0,
      totalKeluarga: keluarga.count ?? 0,
      totalKunjungan: kunjungan.count ?? 0,
      belumKonfirmasiKeluarga: belumKel.count ?? 0,
      belumKonfirmasiKapus: belumKapus.count ?? 0,
      sedangDiproses: proses.count ?? 0,
      sudahSelesai: selesai.count ?? 0,
      userAktifHariIni: aktifToday.count ?? 0,
      draftPending: draftPending.count ?? 0,
      registeredHariIni: (regKelToday.count ?? 0) + (regKunToday.count ?? 0),
    };
  }

  if ((role === "admin_puskesmas" || role === "perawat") && puskesmasId) {
    const [keluarga, kunjungan, belumKel, belumKapus, proses, selesai, perawat, aktifToday, draftPending, regKelToday, regKunToday] = await Promise.all([
      supabaseAdmin.from("keluarga").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).is("deleted_at", null),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).is("deleted_at", null)),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_registered", false).is("deleted_at", null)),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_registered", true).eq("tindakan", "pengajuan").is("deleted_at", null)),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_registered", true).in("tindakan", ["disetujui", "proses"]).is("deleted_at", null)),
      buildKunjunganQuery(supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("tindakan", "selesai").is("deleted_at", null)),
      supabaseAdmin.rpc("count_perawat_in_puskesmas", { _puskesmas_id: puskesmasId }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).gte("last_activity_at", todayISO),
      supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_registered", false).eq("tindakan", "pengajuan").is("deleted_at", null),
      supabaseAdmin.from("keluarga").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_registered", true).gte("registered_at", todayISO),
      supabaseAdmin.from("kunjungan").select("id", { count: "exact", head: true }).eq("puskesmas_id", puskesmasId).eq("is_registered", true).gte("registered_at", todayISO),
    ]);
    return {
      role,
      scope: "puskesmas",
      totalKeluarga: keluarga.count ?? 0,
      totalKunjungan: kunjungan.count ?? 0,
      belumKonfirmasiKeluarga: belumKel.count ?? 0,
      belumKonfirmasiKapus: belumKapus.count ?? 0,
      sedangDiproses: proses.count ?? 0,
      sudahSelesai: selesai.count ?? 0,
      totalPerawat: (perawat.data as number | null) ?? 0,
      userAktifHariIni: aktifToday.count ?? 0,
      draftPending: draftPending.count ?? 0,
      registeredHariIni: (regKelToday.count ?? 0) + (regKunToday.count ?? 0),
    };
  }

  // keluarga (warga)
  const [kunjunganTotal, kunjunganDraft, kunjunganProses, kunjunganSelesai] = await Promise.all([
    buildKunjunganQuery(
      supabaseAdmin.from("kunjungan").select("id, keluarga_id, keluarga!inner(user_id)", { count: "exact", head: true })
        .is("deleted_at", null).eq("keluarga.user_id", userId)
    ),
    buildKunjunganQuery(
      supabaseAdmin.from("kunjungan").select("id, keluarga_id, keluarga!inner(user_id)", { count: "exact", head: true })
        .is("deleted_at", null).eq("keluarga.user_id", userId).eq("is_registered", false)
    ),
    buildKunjunganQuery(
      supabaseAdmin.from("kunjungan").select("id, keluarga_id, keluarga!inner(user_id)", { count: "exact", head: true })
        .is("deleted_at", null).eq("keluarga.user_id", userId).eq("is_registered", true).neq("tindakan", "selesai")
    ),
    buildKunjunganQuery(
      supabaseAdmin.from("kunjungan").select("id, keluarga_id, keluarga!inner(user_id)", { count: "exact", head: true })
        .is("deleted_at", null).eq("keluarga.user_id", userId).eq("tindakan", "selesai")
    ),
  ]);
  return {
    role,
    scope: "keluarga",
    totalKunjungan: kunjunganTotal.count ?? 0,
    belumKonfirmasiKeluarga: kunjunganDraft.count ?? 0,
    sedangDiproses: kunjunganProses.count ?? 0,
    sudahSelesai: kunjunganSelesai.count ?? 0,
  };
}

export async function getDashboardActivity() {
  const { userId } = await checkAuth();
  const role = await getRole(userId);
  const puskesmasId = await getPuskesmasId(userId);

  let auditQ = supabaseAdmin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(10);
  let kunjunganQ = supabaseAdmin
    .from("kunjungan")
    .select("id, kunjungan_code, status, jenis_kunjungan, tanggal_kunjungan, keluarga_id")
    .is("deleted_at", null)
    .order("tanggal_kunjungan", { ascending: false })
    .limit(5);
  let keluargaQ = supabaseAdmin
    .from("keluarga")
    .select("id, keluarga_code, kepala_keluarga, is_registered, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

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
    // BUGFIX: kunjunganQ sebelumnya tidak difilter sama sekali untuk role
    // keluarga (cuma di-scope kalau puskesmasId ada, padahal keluarga tidak
    // punya puskesmas_id di profiles) -- widget "Kunjungan Terbaru" bisa
    // kebocor nampilin kunjungan keluarga lain.
    kunjunganQ = supabaseAdmin
      .from("kunjungan")
      .select("id, kunjungan_code, status, jenis_kunjungan, tanggal_kunjungan, keluarga_id, keluarga!inner(user_id)")
      .is("deleted_at", null)
      .eq("keluarga.user_id", userId)
      .order("tanggal_kunjungan", { ascending: false })
      .limit(5);
    keluargaQ = supabaseAdmin
      .from("keluarga")
      .select("id, keluarga_code, kepala_keluarga, is_registered, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5);
  }

  const [{ data: audit }, { data: kunjungan }, { data: keluarga }] = await Promise.all([auditQ, kunjunganQ, keluargaQ]);

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
