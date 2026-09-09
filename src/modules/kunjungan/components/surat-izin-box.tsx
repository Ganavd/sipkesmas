"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { attachmentService, type AttachmentRow } from "@/services/attachment.service";

interface SuratIzinBoxProps {
  kunjunganId: string;
}

export function SuratIzinBox({ kunjunganId }: SuratIzinBoxProps) {
  const [attachment, setAttachment] = useState<AttachmentRow | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    attachmentService
      .getLatestForEntity("kunjungan", kunjunganId)
      .then((row) => { if (!cancelled) setAttachment(row); })
      .catch(() => { if (!cancelled) setAttachment(null); });
    return () => { cancelled = true; };
  }, [kunjunganId]);

  const pdfUrl = attachment?.file_url ?? null;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-muted/40 px-4 py-2.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2 text-base font-semibold text-foreground">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span>Surat Permohonan Izin</span>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border pt-3">
          <div className="h-[36rem] bg-muted/10">
            {pdfUrl ? (
              <iframe src={`${pdfUrl}#toolbar=1&navpanes=0`} className="h-full w-full" title="Lampiran surat izin" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">Belum ada lampiran</p>
                <p className="text-xs text-muted-foreground">Tidak ada surat izin yang diunggah saat pengajuan ini.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}