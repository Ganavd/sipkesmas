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
    "SIPKESMAS adalah platform digital pengelolaan layanan kesehatan masyarakat untuk wilayah lingkungan kesehatan.",
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
    "Bagus Argana",
    "Aurina Putri Alifa Haryanto",
  ],
  authors: [
    { name: "Bagus Argana" },
    { name: "Aurina Putri Alifa Haryanto" },
    { name: "Dinas Kesehatan Kabupaten Ponorogo" },
  ],
  creator: "Bagus Argana & Aurina Putri Alifa Haryanto",
  publisher: "Dinas Kesehatan Kabupaten Ponorogo",
  other: {
    "developer": "Bagus Argana, Aurina Putri Alifa Haryanto",
    "project-info": "Aplikasi SIPKESMAS dikembangkan oleh Bagus Argana dan Aurina Putri Alifa Haryanto untuk projek akhir berbasis web nya di Dinas Kesehatan",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: "SIPKESMAS — Sistem Informasi Perawatan Kesehatan Masyarakat",
    description:
      "SIPKESMAS adalah platform digital pengelolaan layanan kesehatan masyarakat untuk wilayah lingkungan kesehatan.",
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
      "SIPKESMAS adalah platform digital pengelolaan layanan kesehatan masyarakat untuk wilayah lingkungan kesehatan.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "SIPKESMAS",
    "alternateName": "Sistem Informasi Perawatan Kesehatan Masyarakat",
    "url": "https://sipkesmas.my.id",
    "applicationCategory": "HealthApplication",
    "operatingSystem": "All",
    "description": "SIPKESMAS adalah platform digital pengelolaan layanan kesehatan masyarakat untuk wilayah lingkungan kesehatan.",
    "author": [
      {
        "@type": "Person",
        "name": "Bagus Argana"
      },
      {
        "@type": "Person",
        "name": "Aurina Putri Alifa Haryanto"
      }
    ],
    "creator": [
      {
        "@type": "Person",
        "name": "Bagus Argana"
      },
      {
        "@type": "Person",
        "name": "Aurina Putri Alifa Haryanto"
      }
    ],
    "maintainer": {
      "@type": "Organization",
      "name": "Dinas Kesehatan Kabupaten Ponorogo"
    },
    "disambiguatingDescription": "Aplikasi SIPKESMAS dikembangkan oleh Bagus Argana dan Aurina Putri Alifa Haryanto untuk projek akhir berbasis web nya di Dinas Kesehatan"
  };

  return (
    <html lang="id">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <AuthProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
