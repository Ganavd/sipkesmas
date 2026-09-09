/**
 * Operational workflow state derivation — terpusat untuk badge & banner.
 * Mendukung lima slot state; saat ini tiga di antaranya benar-benar
 * dapat diturunkan dari data (sisanya direservasi untuk ekspansi).
 */
export type WorkflowOperationalState =
  | "belum_terdaftar"
  | "pending_verifikasi"
  | "terdaftar"
  | "override_dinkes"
  | "draft_expired";

export const WORKFLOW_STATE_LABEL: Record<WorkflowOperationalState, string> = {
  belum_terdaftar: "Belum Terdaftar",
  pending_verifikasi: "Menunggu Verifikasi",
  terdaftar: "Terdaftar",
  override_dinkes: "Override Dinkes",
  draft_expired: "Draft Expired",
};

export const WORKFLOW_STATE_STYLE: Record<WorkflowOperationalState, string> = {
  belum_terdaftar: "bg-muted text-muted-foreground",
  pending_verifikasi: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  terdaftar: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  override_dinkes: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  draft_expired: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
};

export interface WorkflowEntityLike {
  is_registered?: boolean | null;
  workflow_status?: string | null;
  workflow_note?: string | null;
  draft_expires_at?: string | null;
  registered_at?: string | null;
}

export function deriveWorkflowState(row: WorkflowEntityLike): WorkflowOperationalState {
  if (row.is_registered) {
    // Jika workflow_note ditulis SETELAH registered_at → indikasi override Dinkes.
    if (row.workflow_note && row.registered_at) {
      return "override_dinkes";
    }
    return "terdaftar";
  }
  if (row.draft_expires_at) {
    const exp = new Date(row.draft_expires_at).getTime();
    if (Number.isFinite(exp) && exp < Date.now()) return "draft_expired";
  }
  return "belum_terdaftar";
}