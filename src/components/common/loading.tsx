import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  label?: string;
  className?: string;
  fullscreen?: boolean;
}

export function Loading({ label = "Memuat...", className, fullscreen }: LoadingProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 text-muted-foreground",
        fullscreen ? "min-h-screen w-full" : "py-12",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
