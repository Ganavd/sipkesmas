import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { listNotifications, markNotificationRead } from "@/lib/notification.functions";

interface NotifItem {
  id: string;
  title: string;
  body: string | null;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const load = async (announce = false) => {
    try {
      const res = await listNotifications({ limit: 20 });
      const nextItems = res.items as NotifItem[];
      if (announce && initialized.current) {
        const newest = nextItems.filter((item) => !knownIds.current.has(item.id)).slice(0, 3);
        newest.reverse().forEach((item) => {
          toast.custom(
            () => (
              <div className="relative w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card px-4 py-3 text-card-foreground shadow-xl">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.body && <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>}
                <span
                  className="absolute inset-x-0 bottom-0 h-1 origin-left bg-success"
                  style={{ animation: "notification-progress 6500ms linear forwards" }}
                />
              </div>
            ),
            { duration: 6500, position: "bottom-right" },
          );
        });
      }
      nextItems.forEach((item) => knownIds.current.add(item.id));
      initialized.current = true;
      setItems(nextItems);
      setUnread(res.unread);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    // Keep the bell lightweight: do not fetch notification rows until the
    // user intentionally opens the popover. This avoids an extra query on
    // every authenticated route mount.
  }, []);

  const onMarkAll = async () => {
    try {
      await markNotificationRead({ all: true });
      setUnread(0);
      setItems([]);
    } catch {
      /* silent */
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifikasi">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifikasi</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onMarkAll}>
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Tandai semua
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada notifikasi.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id} className={cn("px-3 py-2.5", !n.is_read && "bg-muted/40")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {!n.is_read && (
                      <Badge variant="secondary" className="text-[10px]">
                        Baru
                      </Badge>
                    )}
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), {
                      addSuffix: true,
                      locale: idLocale,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
