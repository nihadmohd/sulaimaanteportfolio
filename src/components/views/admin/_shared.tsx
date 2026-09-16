"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useSession, STAFF_ROLES } from "@/hooks/use-session";
import { apiFetch } from "@/components/views/auth/_shared";
import { cn } from "@/lib/utils";

/**
 * Admin & Developer console shared kit (private module — Task 6-a).
 *
 * · useAdminGuard  — defensive staff gate for every admin view
 * · apiFetch       — re-exported envelope-aware fetcher (5-a helper, sanctioned)
 * · CopyText       — 44px copy-to-clipboard affordance with feedback
 * · ConfirmAction  — AlertDialog-wrapped destructive action
 * · AdminPager     — pagination controls for list views
 * · badges/time helpers — status/priority/role chips + date formatting
 */

export { apiFetch };

/* ------------------------------------------------------------------ */
/* staff gate                                                          */
/* ------------------------------------------------------------------ */

export interface AdminGuardState {
  user: ReturnType<typeof useSession>["user"];
  isLoading: boolean;
  allowed: boolean;
}

export function useAdminGuard(): AdminGuardState {
  const { user, isLoading } = useSession();
  return {
    user,
    isLoading,
    allowed: !!user && STAFF_ROLES.includes(user.role),
  };
}

/* ------------------------------------------------------------------ */
/* copy button                                                         */
/* ------------------------------------------------------------------ */

export function CopyText({
  value,
  label,
  className,
  iconOnly = false,
}: {
  value: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: "Copied", description: `${label ?? "Value"} copied to clipboard.` });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({
        title: "Could not copy",
        description: `${label ?? "Value"}: ${value}`,
        variant: "destructive",
      });
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label ?? "value"}: ${value}`}
      title={`Copy ${label ?? "value"}`}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-md px-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {!iconOnly ? <span className="break-all">{value}</span> : null}
      {copied ? (
        <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* destructive confirm                                                 */
/* ------------------------------------------------------------------ */

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  buttonVariant = "destructive",
  className,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  buttonVariant?: "destructive" | "default";
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const action = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-gold" aria-hidden="true" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={action}
            disabled={busy}
            className={cn(buttonVariant === "destructive" && "bg-destructive text-white hover:bg-destructive/90")}
          >
            {busy ? "Working..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------ */
/* pagination                                                          */
/* ------------------------------------------------------------------ */

export function AdminPager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <p className="px-1 text-xs text-muted-foreground" role="status">
        {total} {total === 1 ? "item" : "items"}
      </p>
    );
  }
  return (
    <nav
      className="flex items-center gap-2"
      aria-label="Pagination"
    >
      <p className="mr-auto text-xs text-muted-foreground" role="status">
        {total} {total === 1 ? "item" : "items"} · page {page} of {totalPages}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Previous page"
        className="h-9"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Prev
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="h-9"
      >
        Next
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* date helpers                                                        */
/* ------------------------------------------------------------------ */

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d MMM yyyy");
  } catch {
    return "—";
  }
}

/* ------------------------------------------------------------------ */
/* debounce hook                                                       */
/* ------------------------------------------------------------------ */

export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ------------------------------------------------------------------ */
/* slug helper (client mirror of api/_lib/serialize slugify)            */
/* ------------------------------------------------------------------ */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

/* ------------------------------------------------------------------ */
/* datetime-local helpers (offer windows, ad schedules)                 */
/* ------------------------------------------------------------------ */

/** ISO string → datetime-local input value ("YYYY-MM-DDTHH:mm"), local tz. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

/** datetime-local input value → ISO string, or null when empty/invalid. */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/* ------------------------------------------------------------------ */
/* status / priority / role badges                                     */
/* ------------------------------------------------------------------ */

type BadgeTone = "emerald" | "gold" | "amber" | "red" | "muted" | "teal";

const TONE_CLASSES: Record<BadgeTone, string> = {
  emerald: "border-primary/30 bg-primary/10 text-primary",
  gold: "border-gold/40 bg-gold/10 text-gold",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
  teal: "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400",
};

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(TONE_CLASSES[tone], "font-medium", className)}>
      {children}
    </Badge>
  );
}

export function PostStatusBadge({ status }: { status: string }) {
  const tone = status === "published" ? "emerald" : status === "draft" ? "amber" : "muted";
  return <ToneBadge tone={tone}>{status}</ToneBadge>;
}

export function ProductStatusBadge({ status }: { status: string }) {
  const tone = status === "active" ? "emerald" : status === "draft" ? "amber" : "muted";
  return <ToneBadge tone={tone}>{status}</ToneBadge>;
}

const INQUIRY_STATUS_TONE: Record<string, BadgeTone> = {
  new: "gold",
  in_progress: "teal",
  replied: "emerald",
  closed: "muted",
  spam: "red",
};

export function InquiryStatusBadge({ status }: { status: string }) {
  const tone = INQUIRY_STATUS_TONE[status] ?? "muted";
  return <ToneBadge tone={tone}>{status.replace("_", " ")}</ToneBadge>;
}

const PRIORITY_TONE: Record<string, BadgeTone> = {
  low: "muted",
  normal: "emerald",
  high: "amber",
  urgent: "red",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const tone = PRIORITY_TONE[priority] ?? "muted";
  return <ToneBadge tone={tone}>{priority}</ToneBadge>;
}

export function RoleBadge({ role }: { role: string }) {
  const tone: BadgeTone =
    role === "admin"
      ? "gold"
      : role === "editor"
        ? "teal"
        : role === "author"
          ? "emerald"
          : role === "advertiser"
            ? "amber"
            : "muted";
  const label = role === "admin" ? "Admin" : role.charAt(0).toUpperCase() + role.slice(1);
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}

/* ------------------------------------------------------------------ */
/* KPI card                                                            */
/* ------------------------------------------------------------------ */

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* shared queries                                                      */
/* ------------------------------------------------------------------ */

/** Blog/store categories for Select inputs. */
export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  scope: string;
}

export function useCategories(scope: "blog" | "store") {
  return useQuery({
    queryKey: ["admin-categories", scope],
    queryFn: () =>
      apiFetch<CategoryOption[]>(`/api/categories?scope=${scope}`).catch(() => [] as CategoryOption[]),
    staleTime: 60_000,
    retry: 1,
  });
}

/** Presence REST fallback (online count or null when the service is down). */
export function usePresenceOnline(intervalMs: number) {
  return useQuery({
    queryKey: ["admin-presence"],
    queryFn: async (): Promise<number | null> => {
      try {
        const res = await fetch("/api/presence", { credentials: "include" });
        if (!res.ok) return null;
        const json = (await res.json()) as { ok?: boolean; data?: { online?: number | null } };
        return json.data?.online ?? null;
      } catch {
        return null;
      }
    },
    refetchInterval: intervalMs,
    staleTime: 5_000,
    retry: 0,
  });
}

/* ------------------------------------------------------------------ */
/* format                                                              */
/* ------------------------------------------------------------------ */

/** 1234 → "1.2k" (compact count display). */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

/** INR currency: 399 → "₹399". */
export function formatINR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** uptime seconds → "1h 4m" style. */
export function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${s % 60}s`;
}
