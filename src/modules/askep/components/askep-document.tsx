"use client";

import type { AskepRow } from "@/services/askep.service";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

function valueOrDash(value?: string | null) {
  return value && value.trim() ? value : "-";
}

function capitalizeFirst(value?: string | null) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[120px_8px_1fr] gap-2 border-b border-black px-2 py-1 text-[11px] leading-snug">
      <span className="font-medium">{label}</span>
      <span>:</span>
      <span>{valueOrDash(value)}</span>
    </div>
  );
}

function Box({ title, children }: { title: string; children?: string | null }) {
  return (
    <section className="border border-black break-inside-avoid">
      <div className="border-b border-black px-2 py-1 text-[11px] font-semibold uppercase bg-gray-50/50">
        {title}
      </div>
      <div className="min-h-16 whitespace-pre-wrap px-2 py-1 text-[11px] leading-snug">
        {valueOrDash(children)}
      </div>
    </section>
  );
}

export function AskepDocument({ item }: { item: AskepRow }) {
  return (
    <article className="askep-print-page bg-white text-black">
      <div className="border border-black">
        <header className="border-b border-black px-4 py-2 text-center">
          <div className="text-sm font-bold uppercase">
            Asuhan Keperawatan Keluarga
          </div>
          <div className="mt-1 text-[11px] uppercase">
            {valueOrDash(item.puskesmas_nama)}
          </div>
          <div className="text-[10px]">
            {valueOrDash(item.puskesmas_alamat)}
          </div>
        </header>

        <div className="grid grid-cols-2 border-b border-black">
          <div className="border-r border-black">
            <Field label="Kode Kunjungan" value={item.kunjungan_code} />
            <Field label="Tanggal Pembuatan" value={formatDateTime(item.tanggal)} />
            <Field label="Tanggal Kunjungan" value={formatDateTime(item.tanggal_kunjungan)} />
          </div>
          <div>
            <Field label="Puskesmas" value={item.puskesmas_nama} />
            <Field label="Kode Puskesmas" value={item.puskesmas_kode} />
            <Field label="Petugas" value={item.petugas_name} />
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-black">
          <div className="border-r border-black">
            <Field label="Kode Keluarga" value={item.keluarga_code} />
            <Field label="Kepala Keluarga" value={item.kepala_keluarga} />
            <Field label="No. KK" value={item.nomor_kk} />
          </div>
          <div>
            <Field label="NIK KK" value={item.nik} />
            <Field label="Telepon" value={item.telepon} />
            <Field label="Jenis Kunjungan" value={capitalizeFirst(item.jenis_kunjungan)} />
          </div>
        </div>

        <div className="grid gap-1.5 p-1.5">
          <Box title="1. Pengkajian" >{item.pengkajian}</Box>
          <Box title="2. Diagnosis Keperawatan">{item.diagnosis}</Box>
          <Box title="3. Rencana Intervensi">{item.rencana_intervensi}</Box>
          <Box title="4. Implementasi">{item.implementasi}</Box>

          <section className="border border-black break-inside-avoid">
            <div className="border-b border-black px-2 py-1 text-[11px] font-semibold uppercase bg-gray-50/50">
              5. Evaluasi SOAP
            </div>
            <div className="grid grid-cols-2">
              <div className="border-b border-r border-black px-2 py-1 text-[11px]">
                <div className="font-semibold">S - Subjektif</div>
                <div className="mt-0.5 min-h-12 whitespace-pre-wrap leading-snug">{valueOrDash(item.evaluasi_s)}</div>
              </div>
              <div className="border-b border-black px-2 py-1 text-[11px]">
                <div className="font-semibold">O - Objektif</div>
                <div className="mt-0.5 min-h-12 whitespace-pre-wrap leading-snug">{valueOrDash(item.evaluasi_o)}</div>
              </div>
              <div className="border-r border-black px-2 py-1 text-[11px]">
                <div className="font-semibold">A - Assessment</div>
                <div className="mt-0.5 min-h-12 whitespace-pre-wrap leading-snug">{valueOrDash(item.evaluasi_a)}</div>
              </div>
              <div className="px-2 py-1 text-[11px]">
                <div className="font-semibold">P - Plan</div>
                <div className="mt-0.5 min-h-12 whitespace-pre-wrap leading-snug">{valueOrDash(item.evaluasi_p)}</div>
              </div>
            </div>
          </section>
        </div>

        <footer className="grid grid-cols-2 border-t border-black text-[11px] break-inside-avoid">
          <div className="border-r border-black px-3 py-2">
            <div className="font-semibold">Isi catatan :</div>
            <div className="mt-1 h-8"></div>
          </div>
          <div className="px-3 py-2 text-center flex flex-col justify-between h-20">
            <div>{formatDate(new Date().toISOString())}</div>
            <div className="mt-auto border-t border-black pt-1 px-4 inline-block mx-auto min-w-32">
              {valueOrDash(item.petugas_name)}
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
}
