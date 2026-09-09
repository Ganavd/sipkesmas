/**
 * usePrintHeader — hook untuk mendapatkan nama puskesmas user yang sedang login,
 * digunakan sebagai header pada dokumen cetak dan nama file PDF.
 *
 * printHeader : "SIPKESMAS | PUSKESMAS JENANGAN"   (untuk ditampilkan di dokumen)
 * getPrintFilename("Daftar Kunjungan")
 *             → "SIPKESMAS — JEN - Daftar Kunjungan"  (untuk document.title / nama PDF)
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { puskesmasService } from "@/services/puskesmas.service";

interface PrintMeta {
  /** Teks header untuk ditampilkan di dalam dokumen cetak */
  printHeader: string;
  /** Menghasilkan nama file PDF sesuai format SIPKESMAS — [KODE] - [Judul] */
  getPrintFilename: (menuTitle: string) => string;
}

export function usePrintHeader(): PrintMeta {
  const { profile } = useAuth();
  const [puskesmasNama, setPuskesmasNama] = useState<string | null>(null);
  const [puskesmasKode, setPuskesmasKode] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.puskesmas_id) {
      setPuskesmasNama(null);
      setPuskesmasKode(null);
      return;
    }

    void puskesmasService.get(profile.puskesmas_id).then((p) => {
      setPuskesmasNama(p?.nama_puskesmas ?? null);
      setPuskesmasKode(p?.kode ?? null);
    }).catch(() => {
      setPuskesmasNama(null);
      setPuskesmasKode(null);
    });
  }, [profile?.puskesmas_id]);

  // Nama uppercase, strip prefix "PUSKESMAS " jika ada
  const namaUpper = puskesmasNama?.toUpperCase().trim() ?? null;
  const namaBersih = namaUpper?.startsWith("PUSKESMAS")
    ? namaUpper.replace(/^PUSKESMAS\s+/, "").trim()
    : namaUpper;

  // Header untuk ditampilkan di dalam dokumen
  const printHeader = namaUpper
    ? `SIPKESMAS | ${namaUpper.startsWith("PUSKESMAS") ? namaUpper : `PUSKESMAS ${namaUpper}`}`
    : "SIPKESMAS";

  const getPrintFilename = useCallback(
    (menuTitle: string): string => {
      if (!puskesmasKode) return `SIPKESMAS - ${menuTitle}`;
      return `SIPKESMAS \u2014 ${puskesmasKode.toUpperCase()} - ${menuTitle}`;
    },
    [puskesmasKode],
  );

  return { printHeader, getPrintFilename };
}
