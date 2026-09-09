import { Badge } from "@/components/ui/badge";
import { TINDAKAN_KUNJUNGAN_LABEL, TINDAKAN_KUNJUNGAN_STYLE, type TindakanKunjungan } from "@/modules/kunjungan/types";

export function KunjunganTindakanBadge({ tindakan }: { tindakan: TindakanKunjungan }) {
  return (
    <Badge variant="outline" className={`border-0 ${TINDAKAN_KUNJUNGAN_STYLE[tindakan]}`}>
      {TINDAKAN_KUNJUNGAN_LABEL[tindakan]}
    </Badge>
  );
}
