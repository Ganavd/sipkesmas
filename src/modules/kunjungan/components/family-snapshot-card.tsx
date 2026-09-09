import Link from "next/link";
import { ExternalLink, HeartPulse, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { KeluargaWithRelations } from "@/modules/keluarga/types";
import { KeluargaStatusBadge } from "@/modules/keluarga/components/keluarga-status-badge";

export function FamilySnapshotCard({ keluarga }: { keluarga: KeluargaWithRelations | null }) {
  if (!keluarga) return null;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Keluarga binaan
              </span>
              <KeluargaStatusBadge status={keluarga.status} />
            </div>
            <p className="text-lg font-semibold text-foreground">{keluarga.kepala_keluarga}</p>
            <p className="font-mono text-xs text-muted-foreground">{keluarga.keluarga_code}</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/keluarga/${keluarga.id}`}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Detail
            </Link>
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Nomor KK</p>
            <p className="font-mono">{keluarga.nomor_kk}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Anggota</p>
            <p className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {keluarga.anggota_count} orang
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs uppercase text-muted-foreground">Alamat</p>
            <p className="text-sm">{keluarga.alamat ?? "-"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
