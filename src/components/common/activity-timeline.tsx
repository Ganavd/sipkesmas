import type { LucideIcon } from "lucide-react";
import { Activity, FilePlus, FileX, RefreshCw, ShieldCheck, CheckCircle2, ShieldAlert } from "lucide-react";
import { waktuRelatif } from "@/modules/kunjungan/utils/format";

export interface TimelineItem {
  id: string;
  action: string;
  entity: string;
  description?: string | null;
  created_at: string;
  actor?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  admin_dinkes: "Admin Dinkes",
  admin_puskesmas: "Admin Puskesmas",
  perawat: "Perawat",
  keluarga: "Keluarga",
};

function iconFor(action: string): LucideIcon {
  if (action === "create") return FilePlus;
  if (action === "delete") return FileX;
  if (action === "status_change") return ShieldCheck;
  if (action === "update") return RefreshCw;
  if (action === "register" || action === "auto_register") return CheckCircle2;
  if (action === "override") return ShieldAlert;
  return Activity;
}

export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada aktivitas tercatat untuk data ini.
      </p>
    );
  }
  return (
    <ol className="space-y-4">
      {items.map((it) => {
        const Icon = iconFor(it.action);
        const roleLabel = it.actor_role ? (ROLE_LABEL[it.actor_role] ?? it.actor_role) : null;
        const actorLine = it.actor_name
          ? `${roleLabel ? roleLabel + " — " : ""}${it.actor_name}`
          : (it.actor ?? null);
        return (
          <li key={it.id} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                {actorLine ? <span className="font-medium">{actorLine}</span> : null}
                {actorLine ? " " : ""}
                <span className={actorLine ? "text-muted-foreground" : ""}>
                  {it.description ?? `${it.action} pada ${it.entity}`}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {waktuRelatif(it.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}