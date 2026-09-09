import type { StatusKunjungan, TindakanKunjungan } from "@/modules/kunjungan/types";
import { STATUS_KUNJUNGAN_STYLE, TINDAKAN_KUNJUNGAN_STYLE } from "@/modules/kunjungan/types";

export function formatTanggalWaktu(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(value));
  } catch { return "-"; }
}

// @deprecated pakai STATUS_KUNJUNGAN_STYLE / TINDAKAN_KUNJUNGAN_STYLE dari
// @/modules/kunjungan/types langsung — dipertahankan sebentar biar file lama
// yang belum sempat diupdate (lihat sipkesmas-rencana-teknis.md) tidak crash,
// tapi jangan dipakai untuk kode baru.
export function statusColor(status: StatusKunjungan): string {
  return STATUS_KUNJUNGAN_STYLE[status] ?? "bg-muted text-muted-foreground";
}

export function tindakanColor(tindakan: TindakanKunjungan): string {
  return TINDAKAN_KUNJUNGAN_STYLE[tindakan] ?? "bg-muted text-muted-foreground";
}

export function waktuRelatif(value: string | null | undefined): string {
  if (!value) return "-";
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return formatTanggalWaktu(value);
}

function formatTanggalWaktuLocal(value: string | null | undefined): string {
  return formatTanggalWaktu(value);
}

export { formatTanggalWaktuLocal };

/**
 * Convert ISO/timestamp string to value cocok untuk <input type="datetime-local">
 * Memakai zona waktu lokal (tanpa offset bug 18:00).
 */
export function toLocalInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}