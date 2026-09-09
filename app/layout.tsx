import "../src/styles.css";
import { AuthProvider } from "@/src/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/common/error-boundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://sipkesmas.my.id"),
  title: {
    default: "SIPKESMAS — Sistem Informasi Perawatan Kesehatan Masyarakat",
    template: "%s | SIPKESMAS",
  },
  description:
    "SIPKESMAS adalah platform digital pengelolaan layanan kesehatan masyarakat untuk Dinas Kesehatan, Puskesmas Jenangan, Perawat, dan Keluarga. Kelola kunjungan, asuhan keperawatan, dan rekam medis secara efisien.",
  keywords: [
    "SIPKESMAS",
    "sistem informasi kesehatan masyarakat",
    "puskesmas",
    "dinas kesehatan",
    "manajemen kunjungan perawat",
    "asuhan keperawatan",
    "asuhan keperawatan digital",
    "rekam medis puskesmas",
    "e-health puskesmas",
    "layanan kesehatan masyarakat Ponorogo",
  ],
  authors: [{ name: "Dinas Kesehatan Kabupaten Ponorogo" }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: "SIPKESMAS — Sistem Informasi Perawatan Kesehatan Masyarakat",
    description:
      "Platform digital pengelolaan layanan kesehatan masyarakat — kunjungan perawat, asuhan keperawatan, dan rekam medis untuk Puskesmas Jenangan.",
    type: "website",
    locale: "id_ID",
    siteName: "SIPKESMAS",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SIPKESMAS — Sistem Informasi Perawatan Kesehatan Masyarakat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SIPKESMAS — Sistem Informasi Perawatan Kesehatan Masyarakat",
    description:
      "Platform digital pengelolaan layanan kesehatan masyarakat untuk Puskesmas Jenangan.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
