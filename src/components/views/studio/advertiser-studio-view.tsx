"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    CheckCircle2,
    Clock,
    ExternalLink,
    Eye,
    Inbox,
    Loader2,
    Megaphone,
    MousePointerClick,
    Pencil,
    Plus,
    Trash2,
    XCircle,
    type LucideIcon,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { ALink } from "@/components/router/link";
import { SingleImageField } from "@/components/shared/image-uploader";
import { formatCompact } from "@/components/shared/post-card";
import { SEOHead } from "@/components/shared/seo-head";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { isAdvertiser, useSession } from "@/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { AdDTO, AdPlacement } from "@/types";

/**
 * Advertiser Studio (#/studio — route key "studio").
 *
 * The self-serve console for MN.KP's paying ad clients (role "advertiser";
 * staff may enter too). Clients submit campaigns, follow the review workflow
 * and track impressions / clicks — but NOTHING they submit is ever public
 * until the owner approves it in the Ad Manager (#/admin/ads):
 *
 *   GET    /api/ads?mine=1   → this advertiser's submissions, newest first
 *   POST   /api/ads          → new submission (server forces pending + client)
 *   PATCH  /api/ads/{id}     → edit OWN submission while still pending
 *   DELETE /api/ads/{id}     → withdraw OWN still-pending submission
 */

/* ------------------------------------------------------------------ */
/* placement + type + status metadata                                   */
/* ------------------------------------------------------------------ */

const PLACEMENT_LABELS: Record<string, string> = {
    "header-banner": "Header banner",
    "blog-inline": "Blog inline",
    "blog-sidebar": "Blog sidebar",
    "between-cards": "Between cards",
    "home-strip": "Home strip",
    "hero-marquee": "Hero marquee",
    "store-side": "Store side",
    "footer-banner": "Footer banner",
    "product-inline": "Product inline",
    marquee: "Marquee",
    sticker: "Sticker",
};

/** Ad types a client may submit (marquee / sticker stay owner-only). */
type SubmitType = "image" | "gif" | "text";
const SUBMIT_TYPES: SubmitType[] = ["image", "gif", "text"];

const TYPE_OPTIONS: Array<{ value: SubmitType; label: string; hint: string }> = [
    { value: "image", label: "Image", hint: "static banner with a link" },
    { value: "gif", label: "GIF", hint: "animated banner with a link" },
    { value: "text", label: "Text", hint: "headline and body, no image" },
];

/** Friendly row badges — covers every AdType the API can return. */
const TYPE_LABELS: Record<string, string> = {
    image: "Image",
    gif: "GIF",
    text: "Text",
    sticker: "Sticker",
    marquee: "Marquee",
};

type ReviewStatus = "pending" | "approved" | "rejected";

const STATUS_META: Record<ReviewStatus, { label: string; icon: LucideIcon; className: string }> = {
    pending: {
        label: "Awaiting review",
        icon: Clock,
        className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    approved: {
        label: "Approved",
        icon: CheckCircle2,
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    rejected: {
        label: "Rejected",
        icon: XCircle,
        className: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
    },
};

const PAGE_WRAPPER = "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8";

/* ------------------------------------------------------------------ */
/* form state + helpers                                                 */
/* ------------------------------------------------------------------ */

interface AdFormState {
    name: string;
    type: SubmitType;
    placement: AdPlacement;
    title: string;
    body: string;
    imageUrl: string;
    imageAlt: string;
    linkUrl: string;
    linkLabel: string;
}

const BLANK_FORM: AdFormState = {
    name: "",
    type: "image",
    placement: "header-banner",
    title: "",
    body: "",
    imageUrl: "",
    imageAlt: "",
    linkUrl: "",
    linkLabel: "Learn more",
};

function formFromAd(ad: AdDTO): AdFormState {
    return {
        name: ad.name,
        type: SUBMIT_TYPES.includes(ad.type as SubmitType) ? (ad.type as SubmitType) : "image",
        placement: ad.placement,
        title: ad.title ?? "",
        body: ad.body ?? "",
        imageUrl: ad.imageUrl ?? "",
        imageAlt: ad.imageAlt ?? "",
        linkUrl: ad.linkUrl ?? "",
        linkLabel: ad.linkLabel || "Learn more",
    };
}

/** EXACT POST /api/ads advertiser body shape (see api/ads/route.ts). */
function buildSubmitBody(form: AdFormState): Record<string, unknown> {
    return {
        name: form.name.trim(),
        type: form.type,
        placement: form.placement,
        title: form.title.trim(),
        body: form.body.trim(),
        imageUrl: form.imageUrl.trim(),
        imageAlt: form.imageAlt.trim(),
        linkUrl: form.linkUrl.trim(),
        linkLabel: form.linkLabel.trim() || "Learn more",
    };
}

interface FormProblem {
    title: string;
    description: string;
}

/** Client-side gate — surfaced as destructive toasts BEFORE any request. */
function validateSubmitForm(form: AdFormState): FormProblem | null {
    if (form.name.trim().length < 2) {
        return {
            title: "Campaign name required",
            description: "Give your campaign a name of at least 2 characters.",
        };
    }
    const link = form.linkUrl.trim();
    if (!link) {
        return {
            title: "Click-through URL required",
            description: "Add the https:// URL or in-app route your ad should open.",
        };
    }
    if (!/^https:\/\//i.test(link) && !link.startsWith("#/")) {
        return {
            title: "Invalid click-through URL",
            description: "Links must start with https:// or be an in-app route like #/store.",
        };
    }
    if (form.type !== "text" && !form.imageUrl.trim()) {
        return {
            title: "Ad creative required",
            description: "Image and GIF campaigns need a creative — upload one before submitting.",
        };
    }
    return null;
}

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    try {
        return format(new Date(iso), "d MMM yyyy");
    } catch {
        return "—";
    }
}

function ctrText(ad: AdDTO): string {
    if (!ad.impressions) return "—";
    return `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%`;
}

/* ------------------------------------------------------------------ */
/* small presentational pieces                                          */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: ReviewStatus }) {
    const meta = STATUS_META[status];
    const Icon = meta.icon;
    return (
        <Badge
            variant="outline"
            className={cn("gap-1.5 px-2.5 py-1 text-[11px] font-medium", meta.className)}
        >
            <Icon className="size-3.5" aria-hidden="true" />
            {meta.label}
        </Badge>
    );
}

interface AdRowProps {
    ad: AdDTO;
    onEdit: (ad: AdDTO) => void;
    onResubmit: (ad: AdDTO) => void;
    onWithdraw: (ad: AdDTO) => void;
    withdrawPending: boolean;
}

function AdRow({ ad, onEdit, onResubmit, onWithdraw, withdrawPending }: AdRowProps) {
    const pending = ad.reviewStatus === "pending";
    const rejected = ad.reviewStatus === "rejected";

    return (
        <Card className="py-4 sm:py-5">
            <CardContent className="px-4 sm:px-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
                    {/* 16:9 creative preview */}
                    <div className="w-full shrink-0 overflow-hidden rounded-lg border bg-muted/40 sm:w-44 lg:w-48">
                        {ad.imageUrl ? (
                            <img
                                src={ad.imageUrl}
                                alt={ad.imageAlt?.trim() ? ad.imageAlt : `${ad.name} — ad creative preview`}
                                loading="lazy"
                                decoding="async"
                                className="aspect-[16/9] w-full object-cover"
                            />
                        ) : (
                            <div
                                aria-hidden="true"
                                className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 bg-gold/10 text-gold"
                            >
                                <Megaphone className="size-5" strokeWidth={1.75} />
                                <span className="text-[10px] font-medium uppercase tracking-[0.14em]">Text ad</span>
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                            <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold sm:text-base">{ad.name}</h3>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <Badge
                                        variant="secondary"
                                        className="px-1.5 py-0 text-[10px] uppercase tracking-wide"
                                    >
                                        {TYPE_LABELS[ad.type] ?? ad.type}
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className="px-1.5 py-0 text-[10px] text-muted-foreground"
                                    >
                                        {PLACEMENT_LABELS[ad.placement] ?? ad.placement}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <StatusBadge status={ad.reviewStatus} />
                                {ad.reviewStatus === "approved" && !ad.active ? (
                                    <Badge
                                        variant="outline"
                                        className="px-1.5 py-0 text-[10px] text-muted-foreground"
                                    >
                                        Not live yet
                                    </Badge>
                                ) : null}
                            </div>
                        </div>

                        {ad.reviewNote ? (
                            <p className="mt-3 border-l-2 border-gold/50 pl-3 text-xs italic leading-relaxed text-muted-foreground">
                                Note from MN.KP: {ad.reviewNote}
                            </p>
                        ) : null}

                        <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Eye className="size-3.5 text-gold" aria-hidden="true" />
                                <dt className="sr-only">Impressions</dt>
                                <dd>
                                    <span className="font-semibold tabular-nums text-foreground">
                                        {formatCompact(ad.impressions)}
                                    </span>{" "}
                                    impressions
                                </dd>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MousePointerClick className="size-3.5 text-gold" aria-hidden="true" />
                                <dt className="sr-only">Clicks</dt>
                                <dd>
                                    <span className="font-semibold tabular-nums text-foreground">
                                        {formatCompact(ad.clicks)}
                                    </span>{" "}
                                    clicks
                                </dd>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <dt>CTR</dt>
                                <dd className="font-semibold tabular-nums text-foreground">{ctrText(ad)}</dd>
                            </div>
                        </dl>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground sm:text-xs">
                            <span>Submitted {formatDate(ad.createdAt)}</span>
                            {ad.updatedAt !== ad.createdAt ? (
                                <span>Updated {formatDate(ad.updatedAt)}</span>
                            ) : null}
                            {ad.reviewedAt ? <span>Reviewed {formatDate(ad.reviewedAt)}</span> : null}
                            {ad.linkUrl ? (
                                <ALink
                                    href={ad.linkUrl}
                                    aria-label={`Open the destination for ${ad.name}`}
                                    className="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline sm:min-h-6"
                                >
                                    Destination
                                    <ExternalLink className="size-3.5" aria-hidden="true" />
                                </ALink>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* actions — pending submissions can be edited or withdrawn; rejected ones resubmitted */}
                {pending ? (
                    <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4">
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-11 sm:size-9"
                            onClick={() => onEdit(ad)}
                            aria-label={`Edit ${ad.name}`}
                            title="Edit submission"
                        >
                            <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-11 text-destructive hover:text-destructive sm:size-9"
                                    aria-label={`Withdraw ${ad.name}`}
                                    title="Withdraw submission"
                                >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Withdraw this submission?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        &ldquo;{ad.name}&rdquo; will be removed from the review queue. You can submit a
                                        new ad at any time.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-destructive text-white hover:bg-destructive/90"
                                        disabled={withdrawPending}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            onWithdraw(ad);
                                        }}
                                    >
                                        {withdrawPending ? (
                                            <>
                                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                                Withdrawing…
                                            </>
                                        ) : (
                                            "Withdraw"
                                        )}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ) : rejected ? (
                    <div className="mt-4 flex items-center justify-end border-t pt-4">
                        <Button
                            variant="outline"
                            className="h-11 gap-2 sm:h-9"
                            onClick={() => onResubmit(ad)}
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            Resubmit
                        </Button>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

/* ------------------------------------------------------------------ */
/* view                                                                 */
/* ------------------------------------------------------------------ */

export default function AdvertiserStudioView() {
    const { user, isLoading } = useSession();
    const queryClient = useQueryClient();
    const allowed = isAdvertiser(user);

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<AdDTO | null>(null);
    const [form, setForm] = React.useState<AdFormState>(BLANK_FORM);

    const mineQuery = useQuery({
        queryKey: ["studio-ads"],
        queryFn: () => apiFetch<{ items: AdDTO[] }>("/api/ads?mine=1"),
        enabled: allowed,
        staleTime: 15_000,
        retry: 1,
    });

    const invalidateMine = () => {
        void queryClient.invalidateQueries({ queryKey: ["studio-ads"] });
    };

    const openCreate = () => {
        setEditing(null);
        setForm(BLANK_FORM);
        setDialogOpen(true);
    };

    const openEdit = (ad: AdDTO) => {
        setEditing(ad);
        setForm(formFromAd(ad));
        setDialogOpen(true);
    };

    /** Rejected ads cannot be edited in place — prefill a FRESH pending submission. */
    const openResubmit = (ad: AdDTO) => {
        setEditing(null);
        setForm(formFromAd(ad));
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditing(null);
        setForm(BLANK_FORM);
    };

    const createMutation = useMutation({
        mutationFn: (state: AdFormState) =>
            apiFetch<AdDTO>("/api/ads", {
                method: "POST",
                body: JSON.stringify(buildSubmitBody(state)),
            }),
        onSuccess: () => {
            toast({
                title: "Ad submitted for review",
                description: "It goes live once MN.KP approves it.",
            });
            closeDialog();
            invalidateMine();
        },
        onError: (e: Error) =>
            toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, state }: { id: string; state: AdFormState }) =>
            apiFetch<AdDTO>(`/api/ads/${id}`, {
                method: "PATCH",
                body: JSON.stringify(buildSubmitBody(state)),
            }),
        onSuccess: () => {
            toast({
                title: "Submission updated",
                description: "It goes live once MN.KP approves it.",
            });
            closeDialog();
            invalidateMine();
        },
        onError: (e: Error) =>
            toast({ title: "Update failed", description: e.message, variant: "destructive" }),
    });

    const withdrawMutation = useMutation({
        mutationFn: (ad: AdDTO) => apiFetch(`/api/ads/${ad.id}`, { method: "DELETE" }),
        onSuccess: (_data, ad) => {
            toast({
                title: "Submission withdrawn",
                description: `${ad.name} was removed from the review queue.`,
            });
            invalidateMine();
        },
        onError: (e: Error) =>
            toast({ title: "Withdraw failed", description: e.message, variant: "destructive" }),
    });

    const items = mineQuery.data?.items;

    const stats = React.useMemo(() => {
        const list = items ?? [];
        return {
            total: list.length,
            approved: list.filter((a) => a.reviewStatus === "approved").length,
            pending: list.filter((a) => a.reviewStatus === "pending").length,
            impressions: list.reduce((n, a) => n + a.impressions, 0),
            clicks: list.reduce((n, a) => n + a.clicks, 0),
        };
    }, [items]);

    const saving = createMutation.isPending || updateMutation.isPending;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const problem = validateSubmitForm(form);
        if (problem) {
            toast({ title: problem.title, description: problem.description, variant: "destructive" });
            return;
        }
        try {
            if (editing) await updateMutation.mutateAsync({ id: editing.id, state: form });
            else await createMutation.mutateAsync(form);
        } catch {
            // onError already surfaced a destructive toast.
        }
    };

    /* ---------------- access gates ---------------- */

    if (isLoading) {
        return (
            <div className={PAGE_WRAPPER}>
                <SEOHead title="Advertiser Studio | MN.KP" noindex />
                <LoadingState variant="spinner" label="Loading studio" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className={PAGE_WRAPPER}>
                <SEOHead title="Advertiser Studio | MN.KP" noindex />
                <div className="flex justify-center py-8 sm:py-14">
                    <Card className="w-full max-w-lg">
                        <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
                            <div
                                aria-hidden="true"
                                className="flex size-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold"
                            >
                                <Megaphone className="size-7" strokeWidth={1.75} />
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                                    Advertiser Studio
                                </p>
                                <h1 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
                                    Sign in to access the Advertiser Studio
                                </h1>
                                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                                    The studio is where advertising clients submit campaigns and track impressions
                                    and clicks. Sign in with your MN.KP advertiser account to continue.
                                </p>
                            </div>
                            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                                <ALink href="#/auth/login" className="w-full sm:w-auto">
                                    <Button className="h-11 w-full sm:h-10 sm:w-auto">Sign in</Button>
                                </ALink>
                                <ALink href="#/advertise" className="w-full sm:w-auto">
                                    <Button variant="outline" className="h-11 w-full sm:h-10 sm:w-auto">
                                        Want to advertise here?
                                    </Button>
                                </ALink>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (!allowed) {
        return (
            <div className={PAGE_WRAPPER}>
                <SEOHead title="Advertiser Studio | MN.KP" noindex />
                <ForbiddenState
                    title="Advertiser access required"
                    description="The Advertiser Studio is reserved for MN.KP advertising clients and staff."
                />
                <Card className="mx-auto max-w-lg">
                    <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                            Advertiser access is granted when your campaign is approved. Inquire at the
                            advertising page.
                        </p>
                        <ALink href="#/advertise">
                            <Button variant="outline" className="h-11 sm:h-10">
                                Visit the advertising page
                            </Button>
                        </ALink>
                    </CardContent>
                </Card>
            </div>
        );
    }

    /* ---------------- studio ---------------- */

    const kpiChips: Array<{ label: string; value: string; icon: LucideIcon; wide?: boolean }> = [
        {
            label: "Submissions",
            value: items ? String(stats.total) : "—",
            icon: Megaphone,
        },
        {
            label: "Approved",
            value: items ? String(stats.approved) : "—",
            icon: CheckCircle2,
        },
        {
            label: "Awaiting review",
            value: items ? String(stats.pending) : "—",
            icon: Clock,
        },
        {
            label: "Impressions & clicks",
            value: items
                ? `${formatCompact(stats.impressions)} impressions · ${formatCompact(stats.clicks)} clicks`
                : "—",
            icon: Eye,
            wide: true,
        },
    ];

    return (
        <div className={PAGE_WRAPPER}>
            <SEOHead
                title="Advertiser Studio | MN.KP"
                description="Submit ads, track performance and manage your campaigns. Every submission is reviewed by MN.KP before it goes live."
                noindex
            />

            {/* header */}
            <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                        Advertiser Studio
                    </p>
                    <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                        Your campaigns
                    </h1>
                    <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
                        Submit ads, track performance, and manage your live campaigns. Every submission is
                        reviewed by MN.KP before it goes live.
                    </p>
                </div>
                <Button onClick={openCreate} className="h-11 gap-2 self-start px-5 sm:h-10 sm:self-auto">
                    <Plus className="size-4" aria-hidden="true" />
                    Submit an ad
                </Button>
            </header>

            {/* KPI chips */}
            <section aria-label="Campaign performance" className="mt-6 sm:mt-8">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {kpiChips.map((chip) => (
                        <div
                            key={chip.label}
                            className={cn(
                                "flex min-h-11 items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 shadow-xs",
                                chip.wide && "col-span-2 lg:col-span-1"
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-gold/30 bg-gold/10 text-gold"
                            >
                                <chip.icon className="size-4" strokeWidth={1.75} />
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
            </section>

            {/* my ads */}
            <section aria-labelledby="my-ads-heading" className="mt-8 sm:mt-10">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="my-ads-heading" className="text-lg font-semibold tracking-tight sm:text-xl">
                        My ads
                    </h2>
                    {items ? (
                        <p className="text-xs text-muted-foreground">
                            {items.length} submission{items.length === 1 ? "" : "s"}
                        </p>
                    ) : null}
                </div>

                {/* persistent review note */}
                <div className="mt-4 flex gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
                    <Megaphone className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                    <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        Nothing you submit goes live automatically — MN.KP reviews every ad before publishing.
                        Rejected ads include a reason so you can edit and resubmit.
                    </p>
                </div>

                <div className="mt-4">
                    <DataState query={mineQuery} empty={false} skeletonRows={4}>
                        {(data) =>
                            data.items.length === 0 ? (
                                <Card className="border-dashed">
                                    <CardHeader className="items-center text-center">
                                        <div
                                            aria-hidden="true"
                                            className="mx-auto flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold"
                                        >
                                            <Inbox className="size-6" strokeWidth={1.75} />
                                        </div>
                                        <h3 className="pt-1 text-lg font-semibold leading-tight">
                                            No campaigns yet
                                        </h3>
                                        <CardDescription className="mx-auto max-w-md text-pretty">
                                            Submit an ad with your creative and click-through link. MN.KP reviews every
                                            submission — once it is approved it goes live in the placement you picked, and
                                            impressions and clicks start counting here.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                                        <Button onClick={openCreate} className="h-11 w-full gap-2 sm:h-10 sm:w-auto">
                                            <Plus className="size-4" aria-hidden="true" />
                                            Submit your first ad
                                        </Button>
                                        <ALink href="#/advertise" className="w-full sm:w-auto">
                                            <Button
                                                variant="outline"
                                                className="h-11 w-full sm:h-10 sm:w-auto"
                                            >
                                                See how advertising works
                                            </Button>
                                        </ALink>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {data.items.map((ad) => (
                                        <AdRow
                                            key={ad.id}
                                            ad={ad}
                                            onEdit={openEdit}
                                            onResubmit={openResubmit}
                                            onWithdraw={(target) => {
                                                void withdrawMutation.mutateAsync(target).catch(() => {
                                                    // onError already surfaced a destructive toast.
                                                });
                                            }}
                                            withdrawPending={
                                                withdrawMutation.isPending && withdrawMutation.variables?.id === ad.id
                                            }
                                        />
                                    ))}
                                </div>
                            )
                        }
                    </DataState>
                </div>
            </section>

            {/* submit / edit dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => (open ? null : closeDialog())}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? `Edit submission — ${editing.name}` : "Submit an ad"}</DialogTitle>
                        <DialogDescription>
                            {editing
                                ? "Update your pending submission. It stays in the review queue until MN.KP approves it."
                                : "Pick a placement, attach your creative and set the link. Your ad goes live once MN.KP approves it."}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit} noValidate className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="studio-ad-name">
                                    Campaign name{" "}
                                    <span aria-hidden="true" className="text-destructive">
                                        *
                                    </span>
                                </Label>
                                <Input
                                    id="studio-ad-name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    maxLength={80}
                                    placeholder="Diwali sale — header push"
                                    aria-required="true"
                                    className="h-11 sm:h-10"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Internal label — only you and MN.KP staff see it.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="studio-ad-type">Ad type</Label>
                                <Select
                                    value={form.type}
                                    onValueChange={(v) => setForm({ ...form, type: v as SubmitType })}
                                >
                                    <SelectTrigger
                                        id="studio-ad-type"
                                        className="h-11 w-full sm:h-10"
                                        aria-label="Ad type"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TYPE_OPTIONS.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label} — {t.hint}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="studio-ad-placement">Placement</Label>
                                <Select
                                    value={form.placement}
                                    onValueChange={(v) => setForm({ ...form, placement: v as AdPlacement })}
                                >
                                    <SelectTrigger
                                        id="studio-ad-placement"
                                        className="h-11 w-full sm:h-10"
                                        aria-label="Placement"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(PLACEMENT_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Where your ad appears once approved.
                                </p>
                            </div>

                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="studio-ad-title">
                                    Headline <span className="font-normal text-muted-foreground">(optional)</span>
                                </Label>
                                <Input
                                    id="studio-ad-title"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    maxLength={200}
                                    placeholder="Big sale — 40% off this week"
                                    className="h-11 sm:h-10"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Shown on the ad itself. For text ads this is the main creative.
                                </p>
                            </div>

                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="studio-ad-body">
                                    Body text <span className="font-normal text-muted-foreground">(optional)</span>
                                </Label>
                                <Textarea
                                    id="studio-ad-body"
                                    rows={3}
                                    value={form.body}
                                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                                    maxLength={2000}
                                    placeholder="One or two short lines that sell the click."
                                />
                            </div>

                            {form.type !== "text" ? (
                                <>
                                    <div className="space-y-2 sm:col-span-2">
                                        <p className="text-sm font-medium">
                                            Ad creative{" "}
                                            <span aria-hidden="true" className="text-destructive">
                                                *
                                            </span>
                                            <span className="ml-1 font-normal text-muted-foreground">
                                                (required for {form.type === "gif" ? "GIF" : "image"} campaigns)
                                            </span>
                                        </p>
                                        <SingleImageField
                                            value={form.imageUrl}
                                            onChange={(url) => setForm({ ...form, imageUrl: url })}
                                            label="Ad creative"
                                            aspect="aspect-[16/9]"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Drop, paste or browse — 16:9 renders best across placements and uploads are
                                            optimised automatically.
                                        </p>
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="studio-ad-image-alt">
                                            Alt text{" "}
                                            <span className="font-normal text-muted-foreground">(optional)</span>
                                        </Label>
                                        <Input
                                            id="studio-ad-image-alt"
                                            value={form.imageAlt}
                                            onChange={(e) => setForm({ ...form, imageAlt: e.target.value })}
                                            maxLength={300}
                                            placeholder="Describe the creative for screen readers"
                                            className="h-11 sm:h-10"
                                        />
                                    </div>
                                </>
                            ) : (
                                <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                                    Text ads use your headline and body as the creative — no image needed.
                                </p>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="studio-ad-link-url">
                                    Click-through URL{" "}
                                    <span aria-hidden="true" className="text-destructive">
                                        *
                                    </span>
                                </Label>
                                <Input
                                    id="studio-ad-link-url"
                                    value={form.linkUrl}
                                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                                    maxLength={1200}
                                    placeholder="https://your-site.com"
                                    inputMode="url"
                                    aria-required="true"
                                    className="h-11 sm:h-10"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="studio-ad-link-label">Button label</Label>
                                <Input
                                    id="studio-ad-link-label"
                                    value={form.linkLabel}
                                    onChange={(e) => setForm({ ...form, linkLabel: e.target.value })}
                                    maxLength={60}
                                    placeholder="Learn more"
                                    className="h-11 sm:h-10"
                                />
                            </div>

                            <p className="text-xs text-muted-foreground sm:col-span-2">
                                Full https:// URLs or in-app routes like #/store both work.
                            </p>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeDialog}
                                disabled={saving}
                                className="h-11 sm:h-10"
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving} className="h-11 gap-2 sm:h-10">
                                {saving ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                        Submitting…
                                    </>
                                ) : editing ? (
                                    "Save changes"
                                ) : (
                                    "Submit for review"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
