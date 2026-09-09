import { cn } from "@/lib/utils";
import { STATUS_LABEL, type StatusKeluarga } from "@/modules/keluarga/types";

const STYLES: Record<StatusKeluarga, string> = {
  aktif: "bg-success-soft text-success",
  nonaktif: "bg-muted text-muted-foreground",
  pindah: "bg-primary-soft text-primary",
  meninggal: "bg-destructive/10 text-destructive",
};

export function KeluargaStatusBadge({ status, isDeleted, className }: { status: StatusKeluarga; isDeleted?: boolean; className?: string }) {
  const isRed = isDeleted && status === "nonaktif";

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
      STYLES[status], 
      isRed && "bg-destructive/10 text-destructive", 
      className,
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
