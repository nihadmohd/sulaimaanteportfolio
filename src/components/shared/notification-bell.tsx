"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, Info, Mail, Megaphone, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALink } from "@/components/router/link";
import { navigate } from "@/hooks/use-router";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";

/**
 * NotificationBell — header bell for signed-in users.
 * Polls GET /api/notifications every 30s; hidden entirely when the API is
 * unavailable or the visitor is a guest. Locally "seen" notification ids are
 * persisted to localStorage ("mnkp_notif_seen") so the badge reflects
 * server unread count minus what this device has already surfaced.
 */

const SEEN_KEY = "mnkp_notif_seen";
const SEEN_CAP = 200;

export interface NotificationItem {
  id: string;
  type: "inquiry" | "subscriber" | "system" | string;
  title: string;
  body?: string | null;
  time?: string | Date | null;
  href?: string | null;
}

interface NotificationsPayload {
  items: NotificationItem[];
  unreadCount: number;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  inquiry: Mail,
  subscriber: Users,
  system: Info,
  ad_review: Megaphone,
};

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { ids?: unknown };
    if (!Array.isArray(parsed.ids)) return [];
    return parsed.ids.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ids: ids.slice(-SEEN_CAP) }));
  } catch {
    /* ignore storage failures */
  }
}

async function fetchNotifications(): Promise<NotificationsPayload | null> {
  try {
    const res = await fetch("/api/notifications", { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok: boolean;
      data?: { items?: NotificationItem[]; unreadCount?: number };
    };
    if (!json.ok || !Array.isArray(json.data?.items)) return null;
    return {
      items: json.data.items,
      unreadCount: Number(json.data.unreadCount ?? 0),
    };
  } catch {
    return null;
  }
}

export function NotificationBell() {
  const { user } = useSession();
  const { toast } = useToast();
  const [seenIds, setSeenIds] = React.useState<string[]>([]);
  const prevUnread = React.useRef<number | null>(null);

  React.useEffect(() => {
    setSeenIds(readSeen());
  }, []);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const data = query.data ?? null;
  const unread = data ? Math.max(0, data.unreadCount - seenIds.length) : 0;

  React.useEffect(() => {
    if (!data) return;
    if (prevUnread.current !== null && unread > prevUnread.current) {
      const latest = data.items[0];
      toast({
        title: "New notification",
        description: latest?.title ?? "You have unread updates on MN.KP.",
      });
    }
    prevUnread.current = unread;
  }, [unread, data, toast]);

  // Graceful: guest or API missing/error → hide the bell.
  if (!user || !data) return null;

  const markSeen = () => {
    const ids = data.items.map((item) => item.id);
    const merged = Array.from(new Set([...seenIds, ...ids])).slice(-SEEN_CAP);
    setSeenIds(merged);
    writeSeen(merged);
  };

  const markAllRead = async () => {
    markSeen();
    try {
      await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });
    } catch {
      /* server may not exist yet — local seen-state already applied */
    }
    void query.refetch();
  };

  const timeAgo = (time: string | Date | null | undefined): string => {
    if (!time) return "";
    const d = typeof time === "string" ? new Date(time) : time;
    if (Number.isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) markSeen();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
          className="relative size-9"
        >
          <Bell className="size-4.5" aria-hidden="true" />
          {unread > 0 ? (
            <Badge className="absolute -right-0.5 -top-0.5 min-w-4.5 border-transparent bg-gold px-1 text-[10px] font-semibold tabular-nums text-gold-foreground">
              {unread > 9 ? "9+" : unread}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Notifications
          </span>
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs font-medium text-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Mark all read
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-96 overflow-y-auto scrollbar-slim">
          {data.items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing yet — you are all caught up.
            </p>
          ) : (
            <ul className="py-1">
              {data.items.map((item) => {
                const ItemIcon = TYPE_ICONS[item.type] ?? Info;
                const isSeen = seenIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => item.href && navigate(item.href)}
                      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:bg-accent ${isSeen ? "opacity-70" : ""
                        }`}
                    >
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                        <ItemIcon className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        {item.body ? (
                          <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                            {item.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {timeAgo(item.time)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <ALink
            href="/account"
            className="block rounded-md px-2 py-1.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View account activity
          </ALink>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
