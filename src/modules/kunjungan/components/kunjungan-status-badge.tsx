import { Badge } from "@/components/ui/badge";
import { STATUS_KUNJUNGAN_LABEL, type StatusKunjungan } from "@/modules/kunjungan/types";
import { statusColor } from "@/modules/kunjungan/utils/format";

export function KunjunganStatusBadge({ status }: { status: StatusKunjungan }) {
  return (
    <Badge variant="outline" className={`border-0 ${statusColor(status)}`}>
      {STATUS_KUNJUNGAN_LABEL[status]}
    </Badge>
  );
}