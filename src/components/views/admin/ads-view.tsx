"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Check,
  Clock,
  Eye,
  FileText,
  GalleryHorizontal,
  House,
  Layers,
  Megaphone,
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
  Tag,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { EmptyState } from "@/components/states/empty";
import { SEOHead } from "@/components/shared/seo-head";
import { SingleImageField } from "@/components/shared/image-uploader";
import { toast } from "@/hooks/use-toast";
import { AD_IMAGES_MAX, AD_PLACEMENTS } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { AdDTO, AdPlacement, AdPlanDTO, AdSource, AdStatsDTO, AdType } from "@/types";
import { AdminShell } from "./_shell";
import { apiFetch, ConfirmAction, formatCompact, formatINR, ToneBadge, useAdminGuard } from "./_shared";

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
  "hero-marquee": { label: "Hero marquee", hint: "Premium dual-lane marquee on the home hero", icon: Megaphone },
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
  // client campaign fields (Task 14)
  source: AdSource;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  monthlyRate: string;
  planCode: string;
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
  source: "owner",
  clientName: "",
  clientCompany: "",
  clientEmail: "",
  monthlyRate: "",
  planCode: "",
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
    source: ad.source,
    clientName: ad.clientName ?? "",
    clientCompany: ad.clientCompany ?? "",
    clientEmail: ad.clientEmail ?? "",
    monthlyRate: ad.monthlyRate != null ? String(ad.monthlyRate) : "",
    planCode: ad.planCode ?? "",
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
    images: form.type === "marquee" ? form.images.slice(0, AD_IMAGES_MAX) : [],
    linkUrl: form.linkUrl.trim(),
    linkLabel: form.linkLabel.trim() || "Learn more",
    priority: Math.min(100, Math.max(0, Math.round(Number(form.priority) || 0))),
    startAt: localInputToIso(form.startAt),
    endAt: localInputToIso(form.endAt),
    active: form.active,
    source: form.source,
    clientName: form.clientName.trim(),
    clientCompany: form.clientCompany.trim(),
    clientEmail: form.clientEmail.trim(),
    monthlyRate: form.monthlyRate ? Number(form.monthlyRate) : null,
    planCode: form.planCode && form.planCode !== "none" ? form.planCode : "",
  };
}

/* ------------------------------------------------------------------ */
/* ad plan form (Task 14 — plans manager tab)                          */
/* ------------------------------------------------------------------ */

interface PlanFormState {
  name: string;
  priceMonthly: string;
  description: string;
  featuresText: string; // one selling point per line
  placements: AdPlacement[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: string;
}

const BLANK_PLAN_FORM: PlanFormState = {
  name: "",
  priceMonthly: "",
  description: "",
  featuresText: "",
  placements: [],
  isActive: true,
  isFeatured: false,
  sortOrder: "0",
};

function planFormFromPlan(plan: AdPlanDTO): PlanFormState {
  return {
    name: plan.name,
    priceMonthly: String(plan.priceMonthly),
    description: plan.description ?? "",
    featuresText: plan.features.join("\n"),
    placements: plan.placements,
    isActive: plan.isActive,
    isFeatured: plan.isFeatured,
    sortOrder: String(plan.sortOrder),
  };
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

interface AdsAllResponse {
  items: AdDTO[];
  stats?: AdStatsDTO;
}

type ViewTab = "campaigns" | "review" | "plans";

export default function AdsView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [viewTab, setViewTab] = React.useState<ViewTab>("campaigns");
  const [placementFilter, setPlacementFilter] = React.useState<"all" | AdPlacement>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdDTO | null>(null);
  const [form, setForm] = React.useState<AdFormState>(BLANK_FORM);
  const [marqueeInput, setMarqueeInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // review queue (Task 14)
  const [rejecting, setRejecting] = React.useState<AdDTO | null>(null);
  const [rejectNote, setRejectNote] = React.useState("");

  // plans manager (Task 14)
  const [planDialogOpen, setPlanDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<AdPlanDTO | null>(null);
  const [planForm, setPlanForm] = React.useState<PlanFormState>(BLANK_PLAN_FORM);
  const [savingPlan, setSavingPlan] = React.useState(false);

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

  const pendingAds = React.useMemo(
    () => (adsQuery.data?.items ?? []).filter((a) => a.reviewStatus === "pending"),
    [adsQuery.data]
  );

  const plansQuery = useQuery({
    queryKey: ["admin-ad-plans"],
    queryFn: () => apiFetch<{ items: AdPlanDTO[] }>("/api/ad-plans?all=1"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-ads-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["ads"] });
  };

  const invalidatePlans = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-ad-plans"] });
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

  /* ---- review workflow (Task 14) ---- */

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      reviewStatus,
      reviewNote,
      active,
    }: {
      id: string;
      reviewStatus: "approved" | "rejected";
      reviewNote?: string;
      active?: boolean;
    }) =>
      apiFetch<AdDTO>(`/api/ads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          reviewStatus,
          ...(reviewNote != null ? { reviewNote } : {}),
          ...(active != null ? { active } : {}),
        }),
      }),
    onSuccess: (ad) => {
      toast({
        title: ad.reviewStatus === "approved" ? "Submission approved" : "Submission rejected",
        description:
          ad.reviewStatus === "approved"
            ? `${ad.name} is live in the ${PLACEMENT_META[ad.placement].label.toLowerCase()} slot.`
            : `${ad.name} was rejected — the client sees your note in their studio.`,
      });
      setRejecting(null);
      setRejectNote("");
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Review failed", description: e.message, variant: "destructive" }),
  });

  /* ---- plans manager (Task 14) ---- */

  const planSaveMutation = useMutation({
    mutationFn: ({ id, state }: { id: string | null; state: PlanFormState }) => {
      const body = {
        name: state.name.trim(),
        priceMonthly: Number(state.priceMonthly || 0),
        description: state.description.trim(),
        features: state.featuresText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        placements: state.placements,
        isActive: state.isActive,
        isFeatured: state.isFeatured,
        sortOrder: Math.min(999, Math.max(0, Math.round(Number(state.sortOrder) || 0))),
      };
      return id
        ? apiFetch<AdPlanDTO>(`/api/ad-plans/${id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiFetch<AdPlanDTO>("/api/ad-plans", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (plan) => {
      toast({
        title: editingPlan ? "Plan saved" : "Plan created",
        description: `${plan.name} — ${formatINR(plan.priceMonthly)}/month.`,
      });
      closePlanDialog();
      invalidatePlans();
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const planToggleMutation = useMutation({
    mutationFn: (plan: AdPlanDTO) =>
      apiFetch<AdPlanDTO>(`/api/ad-plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !plan.isActive }),
      }),
    onSuccess: (plan) => {
      toast({ title: plan.isActive ? "Plan visible" : "Plan hidden", description: plan.name });
      invalidatePlans();
    },
    onError: (e: Error) =>
      toast({ title: "Toggle failed", description: e.message, variant: "destructive" }),
  });

  const planDeleteMutation = useMutation({
    mutationFn: (plan: AdPlanDTO) => apiFetch(`/api/ad-plans/${plan.id}`, { method: "DELETE" }),
    onSuccess: (_data, plan) => {
      toast({
        title: "Plan deleted",
        description: `${plan.name} removed — recoverable from Activity & Undo.`,
      });
      invalidatePlans();
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

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm(BLANK_PLAN_FORM);
    setPlanDialogOpen(true);
  };

  const openEditPlan = (plan: AdPlanDTO) => {
    setEditingPlan(plan);
    setPlanForm(planFormFromPlan(plan));
    setPlanDialogOpen(true);
  };

  const closePlanDialog = () => {
    setPlanDialogOpen(false);
    setEditingPlan(null);
    setPlanForm(BLANK_PLAN_FORM);
  };

  const submitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planForm.name.trim().length < 2) {
      toast({ title: "Name required", description: "Give the plan a name (2+ characters).", variant: "destructive" });
      return;
    }
    if (planForm.priceMonthly.trim() && Number.isNaN(Number(planForm.priceMonthly))) {
      toast({ title: "Invalid price", description: "Monthly price must be a number.", variant: "destructive" });
      return;
    }
    setSavingPlan(true);
    try {
      await planSaveMutation.mutateAsync({ id: editingPlan?.id ?? null, state: planForm });
    } finally {
      setSavingPlan(false);
    }
  };

  const addMarqueeImage = () => {
    const url = marqueeInput.trim();
    if (!url || form.images.includes(url) || form.images.length >= AD_IMAGES_MAX) return;
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
      description="Your ads, the client review queue and the monthly plans sold on #/advertise."
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
          { label: "Pending", value: stats?.pendingReview != null ? String(stats.pendingReview) : "—", icon: Clock },
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

      {/* section tabs: campaigns / review queue / plans (Task 14) */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as ViewTab)} aria-label="Ad manager sections">
        <TabsList className="mb-4 h-10 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="campaigns" className="h-8">Campaigns</TabsTrigger>
          <TabsTrigger value="review" className="h-8 gap-1.5">
            Review queue
            {pendingAds.length > 0 ? (
              <Badge className="bg-amber-500 text-[10px] text-white">{pendingAds.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="plans" className="h-8 gap-1.5">
            <Tag className="size-3.5" aria-hidden="true" />
            Plans
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-0">
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
                                        {ad.source === "client" ? (
                                          <Badge variant="outline" className="border-gold/40 bg-gold/10 px-1.5 py-0 text-[10px] text-gold">
                                            Client{ad.monthlyRate ? ` · ${formatINR(ad.monthlyRate)}/mo` : ""}
                                          </Badge>
                                        ) : null}
                                        {ad.reviewStatus === "pending" ? (
                                          <ToneBadge tone="amber" className="px-1.5 py-0 text-[10px]">Awaiting review</ToneBadge>
                                        ) : ad.reviewStatus === "rejected" ? (
                                          <ToneBadge tone="red" className="px-1.5 py-0 text-[10px]">Rejected</ToneBadge>
                                        ) : null}
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
        </TabsContent>

        {/* ---- review queue (Task 14) ---- */}
        <TabsContent value="review" className="mt-0">
          {pendingAds.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <BadgeCheck className="mx-auto size-7 text-primary" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">Review queue is clear</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                When an advertising client submits an ad from their studio, it waits here —
                nothing a client sends ever goes live until you approve it.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Client submissions waiting for your decision. Approving switches the ad on
                immediately in its chosen placement.
              </p>
              {pendingAds.map((ad) => (
                <Card key={ad.id}>
                  <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {ad.imageUrl ? (
                        <img
                          src={ad.imageUrl}
                          alt={ad.imageAlt ?? ad.name}
                          loading="lazy"
                          className="h-16 w-28 shrink-0 rounded-lg border object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="grid h-16 w-28 shrink-0 place-items-center rounded-lg border bg-muted text-muted-foreground"
                        >
                          <FileText className="size-5" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{ad.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <ToneBadge tone={TYPE_TONE[ad.type]} className="px-1.5 py-0 text-[10px]">
                            {ad.type}
                          </ToneBadge>
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">
                            {PLACEMENT_META[ad.placement].label}
                          </Badge>
                          {ad.submittedById ? (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">
                              Submitted via studio
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1.5 truncate text-xs text-muted-foreground">
                          {[ad.clientName, ad.clientCompany, ad.clientEmail].filter(Boolean).join(" · ") ||
                            "Client campaign"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => openEdit(ad)}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Inspect
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 gap-1.5"
                        disabled={reviewMutation.isPending && reviewMutation.variables?.id === ad.id}
                        onClick={() => reviewMutation.mutate({ id: ad.id, reviewStatus: "approved", active: true })}
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setRejecting(ad);
                          setRejectNote("");
                        }}
                      >
                        <XCircle className="size-3.5" aria-hidden="true" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- plans manager (Task 14) ---- */}
        <TabsContent value="plans" className="mt-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-muted-foreground">
              Monthly packages sold on the public Advertise page. Edit prices and perks any
              time — changes appear on #/advertise instantly.
            </p>
            <Button size="sm" className="h-9 gap-2" onClick={openCreatePlan}>
              <Plus className="size-4" aria-hidden="true" />
              New plan
            </Button>
          </div>
          <DataState query={plansQuery} empty={false} skeletonRows={3}>
            {(data) =>
              data.items.length === 0 ? (
                <EmptyState
                  title="No ad plans yet"
                  description="Create the monthly packages agencies and businesses can buy on the Advertise page."
                  action={
                    <Button onClick={openCreatePlan} className="gap-2">
                      <Plus className="size-4" aria-hidden="true" />
                      Create the first plan
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.items.map((plan) => (
                    <Card
                      key={plan.id}
                      className={cn("flex flex-col", plan.isFeatured && "border-gold/50 bg-gold/[0.03]")}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                              {plan.name}
                              {plan.isFeatured ? (
                                <Badge className="bg-gold text-[10px] text-gold-foreground">Popular</Badge>
                              ) : null}
                            </CardTitle>
                            <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
                              {formatINR(plan.priceMonthly)}
                              <span className="text-xs font-normal text-muted-foreground">/month</span>
                            </p>
                          </div>
                          <Switch
                            checked={plan.isActive}
                            disabled={planToggleMutation.isPending && planToggleMutation.variables?.id === plan.id}
                            onCheckedChange={() => planToggleMutation.mutate(plan)}
                            aria-label={`${plan.isActive ? "Hide" : "Show"} plan ${plan.name}`}
                          />
                        </div>
                        {plan.description ? (
                          <CardDescription className="mt-2 line-clamp-2">{plan.description}</CardDescription>
                        ) : null}
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3">
                        {plan.features.length > 0 ? (
                          <ul className="space-y-1.5" aria-label={`${plan.name} selling points`}>
                            {plan.features.slice(0, 5).map((feature) => (
                              <li key={feature} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {plan.placements.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {plan.placements.map((p) => (
                              <Badge
                                key={p}
                                variant="outline"
                                className="px-1.5 py-0 text-[10px] text-muted-foreground"
                              >
                                {PLACEMENT_META[p]?.label ?? p}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-auto flex gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 gap-1.5"
                            onClick={() => openEditPlan(plan)}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                            Edit
                          </Button>
                          <ConfirmAction
                            trigger={
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label={`Delete plan ${plan.name}`}
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </Button>
                            }
                            title="Delete this plan?"
                            description={`"${plan.name}" disappears from the Advertise page. Recoverable from Activity & Undo.`}
                            onConfirm={() => planDeleteMutation.mutateAsync(plan)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            }
          </DataState>
        </TabsContent>
      </Tabs>

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
                  maxLength={160}
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
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label>Ad image</Label>
                  <SingleImageField
                    value={form.imageUrl}
                    onChange={(url) => setForm({ ...form, imageUrl: url })}
                    label="Ad image"
                    aspect="aspect-video"
                    recommended="wide banner or square sticker — auto-converted to WebP"
                  />
                </div>
                <div className="min-w-0 space-y-2">
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
                    maxLength={200}
                    placeholder="Upgrade to Pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad-body">Body</Label>
                  <Textarea
                    id="ad-body"
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    maxLength={2000}
                    rows={2}
                    placeholder="One or two punchy lines of copy"
                  />
                </div>
              </div>
            ) : null}

            {form.type === "marquee" ? (
              <div className="space-y-2">
                <Label htmlFor="ad-marquee">Marquee images</Label>
                <p className="text-xs text-muted-foreground">Add as many as you need (up to {AD_IMAGES_MAX}).</p>
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

            {/* client campaign (Task 14) */}
            <div className="space-y-4 rounded-lg border border-gold/25 bg-gold/[0.04] p-3.5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Runs for</Label>
                  <Select
                    value={form.source}
                    onValueChange={(v) => setForm({ ...form, source: v as AdSource })}
                  >
                    <SelectTrigger className="h-10 w-full" aria-label="Campaign owner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">My own site promo</SelectItem>
                      <SelectItem value="client">A paying client</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Client campaigns track who pays you and how much, monthly.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select
                    value={form.planCode}
                    onValueChange={(v) => setForm({ ...form, planCode: v })}
                  >
                    <SelectTrigger className="h-10 w-full" aria-label="Ad plan">
                      <SelectValue placeholder="No plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No plan</SelectItem>
                      {(plansQuery.data?.items ?? []).map((plan) => (
                        <SelectItem key={plan.id} value={plan.code}>
                          {plan.name} — {formatINR(plan.priceMonthly)}/mo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.source === "client" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ad-client-name">Client name</Label>
                    <Input
                      id="ad-client-name"
                      value={form.clientName}
                      onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                      maxLength={120}
                      placeholder="Priya Sharma"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-client-company">Company / brand</Label>
                    <Input
                      id="ad-client-company"
                      value={form.clientCompany}
                      onChange={(e) => setForm({ ...form, clientCompany: e.target.value })}
                      maxLength={160}
                      placeholder="Sharma Studios"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-client-email">Client email</Label>
                    <Input
                      id="ad-client-email"
                      type="email"
                      value={form.clientEmail}
                      onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                      maxLength={160}
                      placeholder="priya@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-client-rate">Monthly rate (INR)</Label>
                    <Input
                      id="ad-client-rate"
                      value={form.monthlyRate}
                      onChange={(e) => setForm({ ...form, monthlyRate: e.target.value })}
                      inputMode="numeric"
                      placeholder="1499"
                    />
                    <p className="text-xs text-muted-foreground">Internal only — never shown publicly.</p>
                  </div>
                </div>
              ) : null}
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

      {/* reject dialog (Task 14) */}
      <Dialog
        open={rejecting != null}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
            setRejectNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject “{rejecting?.name}”?</DialogTitle>
            <DialogDescription>
              The client sees this note in their Advertiser Studio and can edit and
              resubmit. A kind, specific reason works best.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Note to the client</Label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="The logo gets cropped at this size — please upload a 16:9 version (1200px or wider) and resubmit."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejecting(null);
                setRejectNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={reviewMutation.isPending}
              onClick={() => {
                if (!rejecting) return;
                reviewMutation.mutate({
                  id: rejecting.id,
                  reviewStatus: "rejected",
                  reviewNote: rejectNote.trim(),
                  active: false,
                });
              }}
            >
              {reviewMutation.isPending ? "Rejecting..." : "Reject submission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* plan create / edit dialog (Task 14) */}
      <Dialog open={planDialogOpen} onOpenChange={(open) => (open ? null : closePlanDialog())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? `Edit plan — ${editingPlan.name}` : "New ad plan"}</DialogTitle>
            <DialogDescription>
              Monthly packages sold on the public Advertise page (#/advertise).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPlan} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Plan name</Label>
                <Input
                  id="plan-name"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Growth"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-price">Monthly price (INR)</Label>
                <Input
                  id="plan-price"
                  value={planForm.priceMonthly}
                  onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })}
                  inputMode="numeric"
                  placeholder="1499"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-desc">Short description</Label>
              <Textarea
                id="plan-desc"
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                rows={2}
                maxLength={2000}
                placeholder="Header banner + blog inline placements on every page."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-features">Selling points (one per line)</Label>
              <Textarea
                id="plan-features"
                value={planForm.featuresText}
                onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })}
                rows={4}
                placeholder={"Slim header banner on all pages\nMid-article inline block"}
              />
            </div>
            <div className="space-y-2">
              <Label>Included placements</Label>
              <div className="flex flex-wrap gap-1.5">
                {AD_PLACEMENTS.map((p) => {
                  const selected = planForm.placements.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setPlanForm({
                          ...planForm,
                          placements: selected
                            ? planForm.placements.filter((x) => x !== p)
                            : [...planForm.placements, p],
                        })
                      }
                      className={cn(
                        "min-h-9 rounded-full border px-2.5 py-1 text-xs transition-colors",
                        selected
                          ? "border-gold bg-gold/10 text-gold"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      {PLACEMENT_META[p].label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Visible</p>
                  <p className="text-xs text-muted-foreground">Shown on #/advertise</p>
                </div>
                <Switch
                  checked={planForm.isActive}
                  onCheckedChange={(v) => setPlanForm({ ...planForm, isActive: v })}
                  aria-label="Plan visible on the advertise page"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Highlight</p>
                  <p className="text-xs text-muted-foreground">“Most popular” styling</p>
                </div>
                <Switch
                  checked={planForm.isFeatured}
                  onCheckedChange={(v) => setPlanForm({ ...planForm, isFeatured: v })}
                  aria-label="Highlight this plan"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-sort">Sort order</Label>
              <Input
                id="plan-sort"
                value={planForm.sortOrder}
                onChange={(e) => setPlanForm({ ...planForm, sortOrder: e.target.value })}
                inputMode="numeric"
                placeholder="0"
                className="sm:max-w-[140px]"
              />
              <p className="text-xs text-muted-foreground">Lower numbers appear first.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePlanDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPlan}>
                {savingPlan ? "Saving..." : editingPlan ? "Save plan" : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
