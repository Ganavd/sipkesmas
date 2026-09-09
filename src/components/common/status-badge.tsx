import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "aktif" | "nonaktif" | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const isActive = status === "aktif";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        isActive ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-success" : "bg-muted-foreground",
        )}
      />
      {isActive ? "Aktif" : "Nonaktif"}
    </span>
  );
}
