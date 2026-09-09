"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    const msg = error.message?.toLowerCase() || "";
    if (
      msg.includes("was not found on the server") ||
      msg.includes("failed-to-find-server-action")
    ) {
      // Force reload from server to get the latest JS bundle
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Oops! Terjadi kesalahan.</h2>
        <p className="text-muted-foreground max-w-[500px]">
          Aplikasi mungkin baru saja diperbarui dan sesi Anda sudah usang. Silakan muat ulang halaman untuk mendapatkan versi terbaru.
        </p>
      </div>
      <div className="flex gap-4 mt-4">
        <Button onClick={() => window.location.reload()}>
          Muat Ulang Halaman
        </Button>
        <Button variant="outline" onClick={() => reset()}>
          Coba Lagi
        </Button>
      </div>
    </div>
  );
}
