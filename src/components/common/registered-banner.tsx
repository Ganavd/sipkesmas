import { Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  registeredAt?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  variant?: "default" | "override";
  className?: string;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "-"; }
}

/**
 * Banner immutable untuk data yang telah didaftarkan resmi.
 * Hanya Admin Dinkes yang dapat melakukan override.
 */
export function RegisteredBanner({
  registeredAt, actorName, actorRole, variant = "default", className,
}: Props) {
  const isOverride = variant === "override";
  const Icon = isOverride ? ShieldCheck : Lock;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border p-3",
        isOverride
          ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-900 dark:bg-fuchsia-950/40 dark:text-fuchsia-200"
          : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
        className,
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold">
          {isOverride
            ? "Data telah dioverride oleh Admin Dinkes"
            : "Data telah terdaftar resmi"}
        </p>
        <p className="mt-0.5 text-xs opacity-90">
          {registeredAt
            ? <>Didaftarkan pada <strong>{formatDate(registeredAt)}</strong>{actorName ? <> oleh <strong>{actorName}</strong>{actorRole ? ` (${actorRole})` : ""}</> : null}.</>
            : <>Status: terdaftar.</>}
          {" "}Perubahan hanya dapat dilakukan oleh Admin Dinkes melalui mekanisme override.
        </p>
      </div>
    </div>
  );
}