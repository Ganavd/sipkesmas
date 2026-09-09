import { ROLE_LABELS, type AppRole } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: AppRole;
  className?: string;
}

const ROLE_STYLES: Record<AppRole, string> = {
  admin_dinkes: "bg-primary-soft text-primary",
  admin_puskesmas: "bg-success-soft text-success",
  perawat: "bg-accent text-accent-foreground",
  keluarga: "bg-muted text-muted-foreground",
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ROLE_STYLES[role],
        className,
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
