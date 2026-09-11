"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  FileText,
  GalleryHorizontal,
  House,
  Layers,
  MousePointerClick,
  Package,
  PanelBottom,
  PanelRight,
  PanelTop,
  Percent,
  Pencil,
  Plus,
  Power,
  Rows3,
  ShoppingBag,
  Sticker,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { EmptyState } from "@/components/states/empty";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import { AD_PLACEMENTS } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { AdDTO, AdPlacement, AdStatsDTO, AdType } from "@/types";
import { AdminShell } from "./_shell";
import { apiFetch, ConfirmAction, formatCompact, ToneBadge, useAdminGuard } from "./_shared";

/**
 * Ad Manager (#/admin/ads — route key "admin-ads").
 * Create ads, pick placements, schedule them and switch on/off inline.
 * KPI chips read GET /api/ads?all=1&stats=1; rows PATCH {active} instantly.
 */

/* ------------------------------------------------------------------ */
/* placement + type metadata                                           */
/* ------------------------------------------------------------------ */

const PLACEMENT_META: Record<AdPlacement, { label: string; hint: string; icon: LucideIcon }> = {
  "header-banner": { label: "Header banner", hint: "Slim strip under the site header", icon: PanelTop },
  "blog-inline": { label: "Blog inline", hint: "Mid-article promo block", icon: FileText },
  "blog-sidebar": { label: "Blog sidebar", hint: "Sticky rail beside articles", icon: PanelRight },
  "between-cards": { label: "Between cards", hint: "Inside list grids between cards", icon: Rows3 },
  "home-strip": { label: "Home strip", hint: "Full-width strip on the home hero", icon: House },
  "store-side": { label: "Store side", hint: "Side panel in the store grid", icon: ShoppingBag },
  "footer-banner": { label: "Footer banner", hint: "Above the site footer", icon: PanelBottom },
  "product-inline": { label: "Product inline", hint: "Inside product detail pages", icon: Package },
  marquee: { label: "Marquee", hint: "Scrolling image strip", icon: GalleryHorizontal },
  sticker: { label: "Sticker", hint: "Floating corner sticker", icon: Sticker },
};

const TYPE_OPTIONS: Array<{ value: AdType; label: string; hint: string }> = [
  { value: "image", label: "Image", hint: "Static banner image with a link" },
  { value: "gif", label: "GIF", hint: "Animated GIF banner with a link" },
  { value: "sticker", label: "Sticker", hint: "Floating sticker — image or short text" },
  { value: "text", label: "Text", hint: "Compact text promo card (title + body)" },
  { value: "marquee", label: "Marquee", hint: "Auto-scrolling strip of images" },
];

type Tone = "emerald" | "gold" | "amber" | "red" | "muted" | "teal";

const TYPE_TONE: Record<AdType, Tone> = {
  image: "gold",
  gif: "amber",
  sticker: "teal",
  text: "emerald",
  marquee: "gold",
};

/* ------------------------------------------------------------------ */
/* form state                                                          */
/* ------------------------------------------------------------------ */

interface AdFormState {
  name: string;
  type: AdType;
  placement: AdPlacement;
  title: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  images: string[];
  linkUrl: string;
  linkLabel: string;
  priority: string;
  startAt: string;
  endAt: string;
  active: boolean;
}

const BLANK_FORM: AdFormState = {
  name: "",
  type: "image",
  placement: "home-strip",
  title: "",
  body: "",
  imageUrl: "",
  imageAlt: "",
  images: [],
  linkUrl: "",
  linkLabel: "Learn more",
  priority: "0",
  startAt: "",
  endAt: "",
  active: true,
};

function formFromAd(ad: AdDTO): AdFormState {
  return {
    name: ad.name,
    type: ad.type,
    placement: ad.placement,
    title: ad.title ?? "",
    body: ad.body ?? "",
    imageUrl: ad.imageUrl ?? "",
    imageAlt: ad.imageAlt ?? "",
    images: ad.images,
    linkUrl: ad.linkUrl ?? "",
    linkLabel: ad.linkLabel || "Learn more",
    priority: String(ad.priority),
    startAt: isoToLocalInput(ad.startAt),
    endAt: isoToLocalInput(ad.endAt),
    active: ad.active,
  };
}

/** ISO string → datetime-local input value ("YYYY-MM-DDTHH:mm"), local tz. */
function isoToLocalInput(iso: string | null): string {
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

/** datetime-local input value → ISO string, or null when empty. */
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Schedule chip: Scheduled (future start) · Live (in window) · Ended (past end). */
function scheduleChip(ad: AdDTO): { label: string; tone: Tone } {
  const now = Date.now();
  const start = ad.startAt ? new Date(ad.startAt).getTime() : null;
  const end = ad.endAt ? new Date(ad.endAt).getTime() : null;
  if (start != null && start > now) return { label: "Scheduled", tone: "amber" };
  if (end != null && end < now) return { label: "Ended", tone: "muted" };
  if (start != null || end != null) return { label: "Live", tone: "emerald" };
  return { label: "—", tone: "muted" };
}

function ctrText(ad: AdDTO): string {
  if (!ad.impressions) return "—";
  return `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%`;
}

function buildAdBody(form: AdFormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    type: form.type,
    placement: form.placement,
    title: form.title.trim(),
    body: form.body.trim(),
    imageUrl: form.imageUrl.trim(),
    imageAlt: form.imageAlt.trim(),
    images: form.type === "marquee" ? form.images.slice(0, 16) : [],
    linkUrl: form.linkUrl.trim(),
    linkLabel: form.linkLabel.trim() || "Learn more",
    priority: Math.min(100, Math.max(0, Math.round(Number(form.priority) || 0))),
    startAt: localInputToIso(form.startAt),
    endAt: localInputToIso(form.endAt),
    active: form.active,
  };
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

interface AdsAllResponse {
  items: AdDTO[];
  stats?: AdStatsDTO;
}

export default function AdsView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [placementFilter, setPlacementFilter] = React.useState<"all" | AdPlacement>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdDTO | null>(null);
  const [form, setForm] = React.useState<AdFormState>(BLANK_FORM);
  const [marqueeInput, setMarqueeInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const statsQuery = useQuery({
    queryKey: ["admin-ads-stats"],
    queryFn: () => apiFetch<AdsAllResponse>("/api/ads?all=1&stats=1"),
    enabled: allowed,
    staleTime: 15_000,
    retry: 1,
  });

  const adsQuery = useQuery({
    queryKey: ["admin-ads"],
    queryFn: () => apiFetch<AdsAllResponse>("/api/ads?all=1"),
    enabled: allowed,
    staleTime: 15_000,
    retry: 1,
  });

  const ads = React.useMemo(() => {
    const items = adsQuery.data?.items ?? [];
    return placementFilter === "all" ? items : items.filter((a) => a.placement === placementFilter);
  }, [adsQuery.data, placementFilter]);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-ads-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["ads"] });
  };

  const createMutation = useMutation({
    mutationFn: (state: AdFormState) =>
      apiFetch<AdDTO>("/api/ads", { method: "POST", body: JSON.stringify(buildAdBody(state)) }),
    onSuccess: (ad) => {
      toast({ title: "Ad created", description: `${ad.name} is live in the ${PLACEMENT_META[ad.placement].label.toLowerCase()} slot.` });
      closeDialog();
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: AdFormState }) =>
      apiFetch<AdDTO>(`/api/ads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(buildAdBody(state)),
      }),
    onSuccess: (ad) => {
      toast({ title: "Ad saved", description: `${ad.name} updated.` });
      closeDialog();
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (ad: AdDTO) =>
      apiFetch<AdDTO>(`/api/ads/${ad.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !ad.active }),
      }),
    onSuccess: (ad) => {
      toast({
        title: ad.active ? "Ad switched on" : "Ad switched off",
        description: ad.name,
      });
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Toggle failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (ad: AdDTO) => apiFetch(`/api/ads/${ad.id}`, { method: "DELETE" }),
    onSuccess: (_data, ad) => {
      toast({
        title: "Ad deleted",
        description: `${ad.name} removed — recover it from Activity & Undo if needed.`,
      });
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading ad manager" />;
  if (!allowed) return <ForbiddenState />;

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK_FORM);
    setMarqueeInput("");
    setDialogOpen(true);
  };

  const openEdit = (ad: AdDTO) => {
    setEditing(ad);
    setForm(formFromAd(ad));
    setMarqueeInput("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(BLANK_FORM);
    setMarqueeInput("");
  };

  const addMarqueeImage = () => {
    const url = marqueeInput.trim();
    if (!url || form.images.includes(url) || form.images.length >= 16) return;
    setForm({ ...form, images: [...form.images, url] });
    setMarqueeInput("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast({ title: "Name required", description: "Give the ad a name (2+ characters).", variant: "destructive" });
      return;
    }
    const link = form.linkUrl.trim();
    if (link && !link.startsWith("#/") && !/^https?:\/\//.test(link)) {
      toast({
        title: "Invalid link URL",
        description: "Use a full https:// URL or an in-app route like #/store.",
        variant: "destructive",
      });
      return;
    }
    if (form.startAt && form.endAt && new Date(form.startAt) >= new Date(form.endAt)) {
      toast({ title: "Invalid schedule", description: "The start must come before the end.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) await updateMutation.mutateAsync({ id: editing.id, state: form });
      else await createMutation.mutateAsync(form);
    } finally {
      setSaving(false);
    }
  };

  const stats = statsQuery.data?.stats;

  return (
    <AdminShell
      title="Ad Manager"
      description="Create ads, pick placements, schedule and switch them on or off."
      actions={
        <Button size="sm" className="h-9 gap-2" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          New ad
        </Button>
      }
    >
      <SEOHead title="Ad Manager — Admin & Developer | MN.KP" noindex />

      {/* KPI chips */}
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Ad performance summary">
        {[
          { label: "Total", value: stats ? String(stats.totalAds) : "—", icon: Layers },
          { label: "Active", value: stats ? String(stats.activeAds) : "—", icon: Power },
          { label: "Impressions", value: stats ? formatCompact(stats.impressions) : "—", icon: Eye },
          { label: "Clicks", value: stats ? formatCompact(stats.clicks) : "—", icon: MousePointerClick },
          { label: "CTR", value: stats ? `${stats.ctr.toFixed(2)}%` : "—", icon: Percent },
        ].map((chip) => (
          <div
            key={chip.label}
            className="flex min-h-11 flex-1 items-center gap-2.5 rounded-lg border bg-card px-3 py-2 shadow-xs sm:flex-none"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold">
              <chip.icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {chip.label}
              </p>
              <p className="text-sm font-semibold tabular-nums">{chip.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* placement filter tabs */}
      <div className="mb-4">
        <Tabs
          value={placementFilter}
          onValueChange={(v) => setPlacementFilter(v as "all" | AdPlacement)}
          aria-label="Filter by placement"
        >
          <TabsList className="h-10 w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="all" className="h-8">All</TabsTrigger>
            {AD_PLACEMENTS.map((p) => (
              <TabsTrigger key={p} value={p} className="h-8 whitespace-nowrap">
                {PLACEMENT_META[p].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <DataState query={adsQuery} empty={false} skeletonRows={6}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              title="No ads yet"
              description="Create your first ad — pick a type, choose exactly where it appears, and flip it on when you're ready."
              action={
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="size-4" aria-hidden="true" />
                  Create your first ad
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {ads.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No ads in this placement yet — switch the filter back to All.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%] min-w-[220px]">Ad</TableHead>
                        <TableHead className="text-center">On</TableHead>
                        <TableHead className="text-right">Priority</TableHead>
                        <TableHead className="text-right">Impr.</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ads.map((ad) => {
                        const sched = scheduleChip(ad);
                        return (
                          <TableRow key={ad.id}>
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span
                                  aria-hidden="true"
                                  className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold"
                                >
                                  {React.createElement(PLACEMENT_META[ad.placement].icon, { className: "size-4" })}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{ad.name}</p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                    <ToneBadge tone={TYPE_TONE[ad.type]} className="px-1.5 py-0 text-[10px]">
                                      {ad.type}
                                    </ToneBadge>
                                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">
                                      {PLACEMENT_META[ad.placement].label}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex min-h-11 items-center justify-center">
                                <Switch
                                  checked={ad.active}
                                  disabled={toggleMutation.isPending && toggleMutation.variables?.id === ad.id}
                                  onCheckedChange={() => toggleMutation.mutate(ad)}
                                  aria-label={`${ad.active ? "Switch off" : "Switch on"} ${ad.name}`}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                              {ad.priority}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {formatCompact(ad.impressions)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {formatCompact(ad.clicks)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{ctrText(ad)}</TableCell>
                            <TableCell>
                              {sched.label === "—" ? (
                                <span className="text-sm text-muted-foreground">—</span>
                              ) : (
                                <ToneBadge tone={sched.tone} className="px-1.5 py-0 text-[10px]">
                                  {sched.label}
                                </ToneBadge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-9"
                                  onClick={() => openEdit(ad)}
                                  aria-label={`Edit ${ad.name}`}
                                >
                                  <Pencil className="size-4" aria-hidden="true" />
                                </Button>
                                <ConfirmAction
                                  trigger={
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-9 text-muted-foreground hover:text-destructive"
                                      aria-label={`Delete ${ad.name}`}
                                    >
                                      <Trash2 className="size-4" aria-hidden="true" />
                                    </Button>
                                  }
                                  title="Delete this ad?"
                                  description={`"${ad.name}" will stop serving immediately. You can bring it back from Activity & Undo.`}
                                  onConfirm={() => deleteMutation.mutateAsync(ad)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Priority 0–100 — higher shows first · links accept https:// URLs or in-app routes like #/store
              </p>
            </div>
          )
        }
      </DataState>

      {/* create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ad — ${editing.name}` : "New ad"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the creative, placement, link or schedule." : "Pick a type, choose exactly where it appears, and switch it on when ready."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ad-name">Name</Label>
                <Input
                  id="ad-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Pro plan — hero push"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as AdType })}
                >
                  <SelectTrigger id="ad-type" className="h-10 w-full" aria-label="Ad type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {TYPE_OPTIONS.find((t) => t.value === form.type)?.hint}
                </p>
              </div>
            </div>

            {/* placement picker — the crown jewel */}
            <div className="space-y-2">
              <Label>Placement — where should this ad appear?</Label>
              <div
                role="radiogroup"
                aria-label="Ad placement"
                className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
              >
                {AD_PLACEMENTS.map((p) => {
                  const meta = PLACEMENT_META[p];
                  const selected = form.placement === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setForm({ ...form, placement: p })}
                      className={cn(
                        "flex min-h-11 flex-col items-start gap-1 rounded-lg border p-2.5 text-left outline-none transition-colors",
                        "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-gold bg-gold/[0.06] shadow-xs" : "border-border"
                      )}
                    >
                      <meta.icon
                        className={cn("size-4 shrink-0", selected ? "text-gold" : "text-muted-foreground")}
                        aria-hidden="true"
                      />
                      <span className={cn("text-xs font-medium leading-tight", selected && "text-gold")}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] leading-tight text-muted-foreground">{meta.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* type-conditional fields */}
            {form.type === "image" || form.type === "gif" || form.type === "sticker" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ad-image">Image URL</Label>
                  <Input
                    id="ad-image"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="https://... or /images/ads/banner.png"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad-alt">Image alt text</Label>
                  <Input
                    id="ad-alt"
                    value={form.imageAlt}
                    onChange={(e) => setForm({ ...form, imageAlt: e.target.value })}
                    maxLength={160}
                    placeholder="Describe the image for screen readers"
                  />
                </div>
              </div>
            ) : null}

            {form.type === "text" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ad-title">Title</Label>
                  <Input
                    id="ad-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    maxLength={120}
                    placeholder="Upgrade to Pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad-body">Body</Label>
                  <Textarea
                    id="ad-body"
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    maxLength={600}
                    rows={2}
                    placeholder="One or two punchy lines of copy"
                  />
                </div>
              </div>
            ) : null}

            {form.type === "marquee" ? (
              <div className="space-y-2">
                <Label htmlFor="ad-marquee">Marquee images (max 16)</Label>
                <div className="flex gap-2">
                  <Input
                    id="ad-marquee"
                    value={marqueeInput}
                    onChange={(e) => setMarqueeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addMarqueeImage();
                      }
                    }}
                    placeholder="Paste an image URL, press Enter"
                    className="h-10 font-mono text-xs"
                  />
                  <Button type="button" variant="outline" className="h-10" onClick={addMarqueeImage}>
                    Add
                  </Button>
                </div>
                {form.images.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {form.images.map((url) => (
                      <Badge key={url} variant="secondary" className="max-w-full gap-1 truncate pr-1.5 font-mono text-[10px]">
                        <span className="truncate">{url}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ ...form, images: form.images.filter((u) => u !== url) })
                          }
                          aria-label={`Remove image ${url}`}
                          className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                        >
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No images yet — they scroll across the strip.</p>
                )}
              </div>
            ) : null}

            {/* link */}
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <Label htmlFor="ad-link">Link URL</Label>
                <Input
                  id="ad-link"
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="https://... or #/store"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Full URL or in-app route like #/store
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-link-label">Link label</Label>
                <Input
                  id="ad-link-label"
                  value={form.linkLabel}
                  onChange={(e) => setForm({ ...form, linkLabel: e.target.value })}
                  maxLength={40}
                  placeholder="Learn more"
                />
              </div>
            </div>

            {/* priority + schedule + active */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ad-priority">Priority (0–100)</Label>
                <Input
                  id="ad-priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  inputMode="numeric"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Higher shows first</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-start">Starts (optional)</Label>
                <Input
                  id="ad-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-end">Ends (optional)</Label>
                <Input
                  id="ad-end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Serves immediately when inside its schedule</p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
                aria-label="Toggle ad active"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save ad" : "Create ad"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
