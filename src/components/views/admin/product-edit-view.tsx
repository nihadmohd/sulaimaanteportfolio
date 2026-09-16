"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ALink } from "@/components/router/link";
import { ForbiddenState, LoadingState } from "@/components/states";
import { GalleryField, SingleImageField } from "@/components/shared/image-uploader";
import { MarkdownBlock, MarkdownFallback } from "@/components/views/shared/markdown";
import { ProductCard, Stars } from "@/components/shared/product-card";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import { useHashParams } from "@/hooks/use-hash-params";
import { navigate } from "@/hooks/use-router";
import type { ProductDTO } from "@/types";
import {
  PRO_CON_ITEM_MAX,
  PRO_CON_MAX,
  PRODUCT_GALLERY_MAX,
  SPEC_LABEL_MAX,
  SPEC_ROW_MAX,
  SPEC_VALUE_MAX,
} from "@/lib/validation";
import { AdminShell } from "./_shell";
import {
  apiFetch,
  ConfirmAction,
  fmtDate,
  formatCompact,
  formatINR,
  isoToLocalInput,
  localInputToIso,
  slugify,
  useAdminGuard,
  useCategories,
} from "./_shared";
import {
  AiAssistCard,
  type AiAssistAction,
  type AiAssistConfirm,
} from "./ai-assist-card";
import { DraftRecoveryBanner, useDraftAutosave } from "./editor-drafts";

/**
 * Product editor (#/admin/products/:id — route key "admin-product-edit";
 * "new"=create). The full affiliate form: auto-slug, markdown description
 * w/ preview, image + gallery chips, price/compare/discount, pros/cons row
 * editors, keySpecs pairs, rating slider, live ProductCard preview.
 *
 * Task 12-b power-features: an AI assist card that drafts an honest review
 * from the specs/pros/cons (backend route /api/ai/assist) and a local
 * autosave + crash-recovery banner (mnkp_draft_product_{id|new}).
 */

const STORE_IMAGES = [
  "/images/brand/marquee-webcraft.webp",
  "/images/brand/marquee-workspace.webp",
  "/images/brand/marquee-photography.webp",
  "/images/brand/marquee-videography.webp",
  "/images/brand/marquee-global.webp",
  "/images/brand/marquee-calicut.webp",
];

const MERCHANT_SUGGESTIONS = ["Amazon", "Flipkart", "MN.KP Digital", "Croma", "Myntra", "Noise"];

/* ---------------- special offer (Task 14) ---------------- */

type OfferKind = "deal" | "cashback" | "coupon" | "bundle" | "giveaway";

const OFFER_KINDS: Array<{ value: OfferKind; label: string; hint: string }> = [
  { value: "deal", label: "Deal", hint: "A straight special price for MN.KP readers" },
  { value: "cashback", label: "Cashback", hint: "Money back after the purchase" },
  { value: "coupon", label: "Coupon", hint: "A claim code buyers apply at checkout" },
  { value: "bundle", label: "Bundle", hint: "Extra item or service included" },
  { value: "giveaway", label: "Giveaway", hint: "A chance to win the product free" },
];

interface OfferState {
  active: boolean;
  title: string;
  description: string;
  kind: OfferKind;
  code: string;
  startsAt: string; // datetime-local
  endsAt: string; // datetime-local
}

const BLANK_OFFER: OfferState = {
  active: false,
  title: "",
  description: "",
  kind: "deal",
  code: "",
  startsAt: "",
  endsAt: "",
};

const productFormSchema = z.object({
  name: z.string().min(3, "Product name is required").max(140),
  slug: z.string().max(96).optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().optional(),
  brand: z.string().max(60).optional(),
  merchant: z.string().max(60).optional(),
  imageUrl: z.string().optional(),
  affiliateUrl: z.string().min(3, "Affiliate URL is required").max(600),
  price: z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Enter a valid price"),
  compareAtPrice: z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Enter a valid price"),
  reviewCount: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 0), "Whole number"),
  status: z.enum(["active", "draft", "archived"]),
  isFeatured: z.boolean(),
  categoryId: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface SpecRow {
  key: string;
  value: string;
}

/** Snapshot payload for the local crash-recovery autosave. */
interface ProductDraftData {
  values: ProductFormValues;
  gallery: string[];
  pros: string[];
  cons: string[];
  keySpecs: SpecRow[];
  rating: number;
  offer: OfferState;
}

export default function ProductEditView() {
  const { id } = useHashParams<{ id: string }>();
  const isNew = !id || id === "new";
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();
  const categories = useCategories("store");

  const [gallery, setGallery] = React.useState<string[]>([]);
  const [pros, setPros] = React.useState<string[]>([]);
  const [cons, setCons] = React.useState<string[]>([]);
  const [keySpecs, setKeySpecs] = React.useState<SpecRow[]>([]);
  const [rating, setRating] = React.useState(0);
  const [offer, setOffer] = React.useState<OfferState>(BLANK_OFFER);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [descTab, setDescTab] = React.useState<"write" | "preview">("write");
  const [extraDirty, setExtraDirty] = React.useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      tagline: "",
      description: "",
      brand: "",
      merchant: "",
      imageUrl: "",
      affiliateUrl: "",
      price: "",
      compareAtPrice: "",
      reviewCount: "",
      status: "active",
      isFeatured: false,
      categoryId: "",
    },
  });

  const productQuery = useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => apiFetch<ProductDTO>(`/api/products/${id}`),
    enabled: allowed && !isNew,
    retry: 1,
  });

  React.useEffect(() => {
    if (!productQuery.data) return;
    const p = productQuery.data;
    form.reset({
      name: p.name,
      slug: p.slug,
      tagline: p.tagline ?? "",
      description: p.description ?? "",
      brand: p.brand ?? "",
      merchant: p.merchant ?? "",
      imageUrl: p.imageUrl ?? "",
      affiliateUrl: p.affiliateUrl,
      price: p.price != null ? String(p.price) : "",
      compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : "",
      reviewCount: String(p.reviewCount ?? 0),
      status: p.status,
      isFeatured: p.isFeatured,
      categoryId: p.category?.id ?? "",
    });
    setGallery(p.gallery);
    setPros(p.pros);
    setCons(p.cons);
    setKeySpecs(Object.entries(p.keySpecs).map(([key, value]) => ({ key, value })));
    setRating(p.rating);
    setOffer({
      active: p.offerActive,
      title: p.offerTitle ?? "",
      description: p.offerDescription ?? "",
      kind: p.offerKind,
      code: p.offerCode ?? "",
      startsAt: isoToLocalInput(p.offerStartsAt),
      endsAt: isoToLocalInput(p.offerEndsAt),
    });
    setSlugTouched(true);
    setExtraDirty(false);
  }, [productQuery.data, form]);

  // useWatch (single call, whole values) instead of form.watch — satisfies
  // react-hooks/incompatible-library; defaults are complete so the cast is safe.
  const watched = useWatch({ control: form.control }) as ProductFormValues;

  const effectiveSlug = slugTouched && watched.slug ? slugify(watched.slug) : slugify(watched.name);
  const priceNum = watched.price ? Number(watched.price) : 0;
  const compareNum = watched.compareAtPrice ? Number(watched.compareAtPrice) : 0;
  const discount =
    compareNum > priceNum && priceNum > 0 ? Math.round((1 - priceNum / compareNum) * 100) : 0;
  const isDirty = form.formState.isDirty || extraDirty;

  /* ---------------- local autosave + crash recovery ---------------- */

  const draftKey = `mnkp_draft_product_${isNew ? "new" : id}`;

  const draft = useDraftAutosave<ProductDraftData>({
    key: draftKey,
    ready: isNew || !!productQuery.data,
    isDirty,
    tick: JSON.stringify([watched, gallery, pros, cons, keySpecs, rating, offer]),
    capture: () => ({ values: form.getValues(), gallery, pros, cons, keySpecs, rating, offer }),
    differs: (snap) => {
      const data = snap.data;
      if (!data || typeof data !== "object" || typeof data.values !== "object" || !data.values) {
        return false; // unrecognized snapshot shape
      }
      if (isNew) {
        return !!(data.values.name?.trim() || data.values.description?.trim());
      }
      const p = productQuery.data;
      if (!p) return false;
      // only offer recovery when the local copy is newer than the server copy
      const serverTime = new Date(p.updatedAt).getTime();
      if (Number.isFinite(serverTime) && snap.savedAt <= serverTime) return false;
      return (
        data.values.name !== p.name ||
        (data.values.description ?? "") !== (p.description ?? "") ||
        data.values.status !== p.status ||
        JSON.stringify(data.pros ?? []) !== JSON.stringify(p.pros) ||
        JSON.stringify(data.cons ?? []) !== JSON.stringify(p.cons) ||
        (data.offer?.active ?? false) !== p.offerActive ||
        (data.offer?.title ?? "") !== (p.offerTitle ?? "")
      );
    },
    onRestore: (data) => {
      const v = data.values;
      form.reset({
        name: v?.name ?? "",
        slug: v?.slug ?? "",
        tagline: v?.tagline ?? "",
        description: v?.description ?? "",
        brand: v?.brand ?? "",
        merchant: v?.merchant ?? "",
        imageUrl: v?.imageUrl ?? "",
        affiliateUrl: v?.affiliateUrl ?? "",
        price: v?.price ?? "",
        compareAtPrice: v?.compareAtPrice ?? "",
        reviewCount: v?.reviewCount ?? "",
        status: v?.status ?? "active",
        isFeatured: !!v?.isFeatured,
        categoryId: v?.categoryId ?? "",
      });
      setGallery(Array.isArray(data.gallery) ? data.gallery : []);
      setPros(Array.isArray(data.pros) ? data.pros : []);
      setCons(Array.isArray(data.cons) ? data.cons : []);
      setKeySpecs(Array.isArray(data.keySpecs) ? data.keySpecs : []);
      setRating(typeof data.rating === "number" ? data.rating : 0);
      setOffer({ ...BLANK_OFFER, ...(data.offer ?? {}) });
      setSlugTouched(true);
      setExtraDirty(true);
      toast({ title: "Local draft restored", description: "Review it and save when you are ready." });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const body: Record<string, unknown> = {
        name: values.name,
        affiliateUrl: values.affiliateUrl,
        status: values.status,
        isFeatured: values.isFeatured,
        currency: "INR",
        imageUrl: values.imageUrl || "",
        gallery: gallery.filter(Boolean),
        pros: pros.map((s) => s.trim()).filter(Boolean),
        cons: cons.map((s) => s.trim()).filter(Boolean),
        keySpecs: Object.fromEntries(
          keySpecs.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value])
        ),
        rating,
        reviewCount: Number(values.reviewCount || 0),
        price: values.price ? Number(values.price) : null,
        compareAtPrice: values.compareAtPrice ? Number(values.compareAtPrice) : null,
        categoryId: values.categoryId || null,
        tagline: values.tagline || undefined,
        description: values.description || undefined,
        brand: values.brand || undefined,
        merchant: values.merchant || undefined,
        // ---- special offer (Task 14) ----
        offerActive: offer.active,
        offerTitle: offer.title.trim(),
        offerDescription: offer.description.trim(),
        offerKind: offer.kind,
        offerCode: offer.code.trim(),
        offerStartsAt: localInputToIso(offer.startsAt) ?? "",
        offerEndsAt: localInputToIso(offer.endsAt) ?? "",
      };
      if (slugTouched && values.slug) body.slug = slugify(values.slug);
      return isNew
        ? apiFetch<ProductDTO>("/api/products", { method: "POST", body: JSON.stringify(body) })
        : apiFetch<ProductDTO>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (product) => {
      toast({ title: isNew ? "Product created" : "Product saved", description: product.name });
      setExtraDirty(false);
      draft.clear();
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      if (isNew) navigate(`/admin/products/${product.id}`);
      else form.reset(form.getValues());
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Product deleted" });
      draft.clear();
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      navigate("/admin/products");
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading editor" />;
  if (!allowed) return <ForbiddenState />;
  if (!isNew && productQuery.isPending) return <LoadingState variant="skeleton" rows={6} />;
  if (!isNew && productQuery.isError) {
    return (
      <AdminShell title="Edit product">
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          This product could not be loaded.{" "}
          {productQuery.error instanceof Error ? productQuery.error.message : ""}
        </p>
      </AdminShell>
    );
  }

  const onSubmit = (values: ProductFormValues) => {
    /* ---- friendly pre-flight checks (Task 14 "Too Big" fix) ---- */
    const longPro = pros.findIndex((s) => s.trim().length > PRO_CON_ITEM_MAX);
    if (longPro >= 0) {
      toast({
        title: `Pro point ${longPro + 1} is too long`,
        description: `Keep each point under ${PRO_CON_ITEM_MAX} characters — split long ones into two.`,
        variant: "destructive",
      });
      return;
    }
    if (pros.filter((s) => s.trim()).length > PRO_CON_MAX) {
      toast({
        title: "Too many pros",
        description: `Up to ${PRO_CON_MAX} points per product.`,
        variant: "destructive",
      });
      return;
    }
    const longCon = cons.findIndex((s) => s.trim().length > PRO_CON_ITEM_MAX);
    if (longCon >= 0) {
      toast({
        title: `Con point ${longCon + 1} is too long`,
        description: `Keep each point under ${PRO_CON_ITEM_MAX} characters — split long ones into two.`,
        variant: "destructive",
      });
      return;
    }
    if (cons.filter((s) => s.trim()).length > PRO_CON_MAX) {
      toast({
        title: "Too many cons",
        description: `Up to ${PRO_CON_MAX} points per product.`,
        variant: "destructive",
      });
      return;
    }
    const longSpecKey = keySpecs.findIndex((row) => row.key.trim().length > SPEC_LABEL_MAX);
    if (longSpecKey >= 0) {
      toast({
        title: `Spec label ${longSpecKey + 1} is too long`,
        description: `Labels must stay under ${SPEC_LABEL_MAX} characters.`,
        variant: "destructive",
      });
      return;
    }
    const longSpecValue = keySpecs.findIndex((row) => row.value.trim().length > SPEC_VALUE_MAX);
    if (longSpecValue >= 0) {
      toast({
        title: `Spec value ${longSpecValue + 1} is too long`,
        description: `Values must stay under ${SPEC_VALUE_MAX} characters.`,
        variant: "destructive",
      });
      return;
    }
    if (keySpecs.filter((row) => row.key.trim()).length > SPEC_ROW_MAX) {
      toast({
        title: "Too many spec rows",
        description: `Up to ${SPEC_ROW_MAX} spec rows per product.`,
        variant: "destructive",
      });
      return;
    }
    if (offer.active && offer.startsAt && offer.endsAt && new Date(offer.startsAt) >= new Date(offer.endsAt)) {
      toast({
        title: "Invalid offer window",
        description: "The offer start must come before its end.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(values);
  };

  /**
   * Amazon URL normalizer — one click turns any messy Amazon link (search
   * URLs, share links with 40 tracking params, short links) into the clean
   * canonical /dp/<ASIN>?tag=… form. Keeps the domain + affiliate tag the
   * owner already used; defaults to amazon.in + mnkp-21.
   */
  const normalizeAmazonUrl = () => {
    const raw = (form.getValues("affiliateUrl") ?? "").trim();
    if (!/^https?:\/\//i.test(raw)) {
      toast({
        title: "Paste an Amazon link first",
        description: "The normalizer works on any amazon.* product or share URL.",
        variant: "destructive",
      });
      return;
    }
    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, "");
      if (!/^amazon\.[a-z.]+$/i.test(host) && !/^amzn\.to$/i.test(host)) {
        toast({
          title: "That is not an Amazon URL",
          description: "Non-Amazon merchants keep their link exactly as pasted.",
        });
        return;
      }
      const existingTag = url.searchParams.get("tag") ?? "";
      const asin =
        /\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})/i.exec(url.pathname)?.[1] ??
        /\/([A-Z0-9]{10})(?:[/?#]|$)/.exec(url.pathname)?.[1] ??
        "";
      if (!asin) {
        toast({
          title: "No product ID found",
          description: "Open the actual product page on Amazon, copy that URL and try again.",
          variant: "destructive",
        });
        return;
      }
      const tag = existingTag || "mnkp-21";
      const canonical = `https://${host}/dp/${asin}?tag=${tag}`;
      if (canonical === raw) {
        toast({ title: "Already clean", description: "This link is already in canonical form." });
        return;
      }
      form.setValue("affiliateUrl", canonical, { shouldDirty: true });
      toast({
        title: "Link cleaned",
        description: `Canonical /dp/${asin} with your ${tag} affiliate tag.`,
      });
    } catch {
      toast({ title: "Could not parse that URL", variant: "destructive" });
    }
  };

  /* ---------------- AI assist wiring ---------------- */

  const buildAiRequest = (action: AiAssistAction): Record<string, unknown> => {
    if (action !== "description") throw new Error("This action is not available for products.");
    const name = (form.getValues("name") ?? "").trim();
    if (!name) throw new Error("Add the product name first.");
    return {
      action,
      productName: name,
      tagline: (form.getValues("tagline") ?? "").trim() || undefined,
      specs: Object.fromEntries(
        keySpecs.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value])
      ),
      pros: pros.map((s) => s.trim()).filter(Boolean),
      cons: cons.map((s) => s.trim()).filter(Boolean),
    };
  };

  const applyAiResult = (action: AiAssistAction, text: string) => {
    if (action !== "description") return;
    form.setValue("description", text, { shouldDirty: true });
    setDescTab("write");
    toast({ title: "Description drafted", description: "Review the copy before saving." });
  };

  const aiConfirmFor = (action: AiAssistAction): AiAssistConfirm | null => {
    if (action !== "description") return null;
    if (!(form.getValues("description") ?? "").trim()) return null; // nothing to lose yet
    return {
      title: "Replace the current description?",
      description: "The markdown description will be replaced by the AI-drafted review. The previous version stays recoverable from your local draft or the server copy until you save.",
    };
  };

  const rowEditor = (
    rows: string[],
    setRows: (rows: string[]) => void,
    label: string,
    placeholder: string
  ) => (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={`${label}-${i}`} className="flex gap-2">
          <Input
            value={row}
            onChange={(e) => {
              const next = [...rows];
              next[i] = e.target.value;
              setRows(next);
              setExtraDirty(true);
            }}
            placeholder={placeholder}
            aria-label={`${label} ${i + 1}`}
            className="h-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => {
              setRows(rows.filter((_, idx) => idx !== i));
              setExtraDirty(true);
            }}
            aria-label={`Remove ${label} ${i + 1}`}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-2"
        onClick={() => {
          setRows([...rows, ""]);
          setExtraDirty(true);
        }}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add {label.toLowerCase()}
      </Button>
    </div>
  );

  return (
    <AdminShell
      title={isNew ? "New product" : "Edit product"}
      description={isNew ? "Add a curated item to the affiliate store." : `Last updated ${fmtDate(productQuery.data?.updatedAt)}`}
      actions={
        <>
          {isDirty ? (
            <Badge variant="outline" className="h-9 border-amber-500/40 bg-amber-500/10 px-3 text-amber-600 dark:text-amber-400">
              Unsaved changes
            </Badge>
          ) : null}
          <ALink href="#/admin/products">
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <ArrowLeft className="size-4" aria-hidden="true" />
              All products
            </Button>
          </ALink>
          <Button
            size="sm"
            className="h-9"
            onClick={form.handleSubmit(onSubmit)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : isNew ? "Create product" : "Save changes"}
          </Button>
          {!isNew ? (
            <ConfirmAction
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-destructive"
                  aria-label="Delete product"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              }
              title="Delete this product?"
              description="The catalog entry and its click history will be permanently removed."
              onConfirm={() => deleteMutation.mutateAsync()}
            />
          ) : null}
        </>
      }
    >
      <SEOHead title={`${isNew ? "New product" : "Edit product"} — Admin & Developer | MN.KP`} noindex />

      {draft.snapshot ? (
        <DraftRecoveryBanner
          savedAt={draft.snapshot.savedAt}
          onRestore={draft.restore}
          onDiscard={draft.discard}
        />
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ---------------- main column ---------------- */}
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-5 pt-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Sony WH-1000XM5 Wireless Headphones" {...field} className="h-10 text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">/store/</span>
                          <Input
                            {...field}
                            value={slugTouched ? field.value : effectiveSlug}
                            onChange={(e) => {
                              setSlugTouched(true);
                              field.onChange(e);
                            }}
                            placeholder="auto-generated-from-name"
                            className="h-10 font-mono text-sm"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        {slugTouched ? "Custom slug — dashes and lowercase" : "Auto-generated from the name (editable)"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tagline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tagline</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="The one-line pitch shown on cards" className="h-10" />
                      </FormControl>
                      <FormDescription>{(field.value ?? "").length}/160 characters</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Sony" className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="merchant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Merchant</FormLabel>
                        <FormControl>
                          <>
                            <Input {...field} value={field.value ?? ""} placeholder="Amazon" list="merchant-suggestions" className="h-10" />
                            <datalist id="merchant-suggestions">
                              {MERCHANT_SUGGESTIONS.map((m) => (
                                <option key={m} value={m} />
                              ))}
                            </datalist>
                          </>
                        </FormControl>
                        <FormDescription>Suggestions: Amazon, Flipkart, MN.KP Digital...</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormLabel>Description (markdown)</FormLabel>
                  <Tabs value={descTab} onValueChange={(v) => setDescTab(v as "write" | "preview")} className="mt-2">
                    <div className="flex items-center justify-between">
                      <TabsList className="h-9">
                        <TabsTrigger value="write" className="h-7">Write</TabsTrigger>
                        <TabsTrigger value="preview" className="h-7">
                          <Eye className="mr-1 size-3.5" aria-hidden="true" />
                          Preview
                        </TabsTrigger>
                      </TabsList>
                      <p className="text-xs text-muted-foreground">
                        {(watched.description ?? "").length.toLocaleString("en-IN")} chars
                      </p>
                    </div>
                  </Tabs>
                  {descTab === "write" ? (
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="mt-3">
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value ?? ""}
                              rows={12}
                              placeholder={"An honest review — who it is for, who should skip it..."}
                              className="min-h-[280px] font-mono text-[13px] leading-relaxed"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="mt-3 min-h-[280px] rounded-lg border p-4">
                      {(watched.description ?? "").trim() ? (
                        <React.Suspense fallback={<MarkdownFallback />}>
                          <MarkdownBlock content={watched.description ?? ""} />
                        </React.Suspense>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                      )}
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="affiliateUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Affiliate URL</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input
                            {...field}
                            placeholder="https://www.amazon.in/dp/...?tag=mnkp-21"
                            className="h-10 font-mono text-[13px]"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 shrink-0 gap-1.5 text-xs"
                            title="Extract the ASIN, strip tracking junk, append your affiliate tag"
                            onClick={normalizeAmazonUrl}
                          >
                            <Wand2 className="size-3.5" aria-hidden="true" />
                            Clean &amp; tag
                          </Button>
                          {/^https?:\/\//.test(field.value ?? "") ? (
                            <a
                              href={field.value ?? ""}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open affiliate URL in a new tab"
                              title="Open affiliate URL"
                              className="flex size-10 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                            >
                              <ExternalLink className="size-4" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Where the Buy button sends visitors — “Clean &amp; tag” turns any
                        messy Amazon link into canonical /dp/&lt;ASIN&gt;?tag=… form
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (INR)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} inputMode="numeric" placeholder="29990" className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="compareAtPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compare-at price (MRP)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} inputMode="numeric" placeholder="34990" className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">Card shows: </span>
                  <span className="font-semibold">{formatINR(priceNum || null)}</span>
                  {discount > 0 ? (
                    <>
                      <span className="ml-2 text-muted-foreground line-through">{formatINR(compareNum)}</span>
                      <Badge className="ml-2 bg-gold text-gold-foreground">-{discount}%</Badge>
                    </>
                  ) : (
                    <span className="ml-2 text-xs text-muted-foreground">no discount</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Special offer (Task 14) */}
            <Card className="border-gold/30">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base">Special offer</CardTitle>
                    <CardDescription>
                      Shown as a gold banner on the product page, a badge on cards
                      and a scrolling chip in the offers ticker — like an ad.
                    </CardDescription>
                  </div>
                  <Switch
                    checked={offer.active}
                    onCheckedChange={(v) => {
                      setOffer({ ...offer, active: v });
                      setExtraDirty(true);
                    }}
                    aria-label="Run a special offer on this product"
                  />
                </div>
              </CardHeader>
              {offer.active ? (
                <CardContent className="space-y-5">
                  <div className="rounded-lg border border-gold/30 bg-gold/[0.06] p-3 text-xs leading-relaxed text-muted-foreground">
                    Write the benefit from the <span className="font-semibold text-foreground">buyer's perspective</span> —
                    for example “Extra ₹500 off for MN.KP readers”. Never mention
                    commissions or margins; the offer simply reads as your gift to
                    buyers.
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Offer type</Label>
                      <Select
                        value={offer.kind}
                        onValueChange={(v) => {
                          setOffer({ ...offer, kind: v as OfferKind });
                          setExtraDirty(true);
                        }}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OFFER_KINDS.map((k) => (
                            <SelectItem key={k.value} value={k.value}>
                              {k.label} — {k.hint}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offer-code">Coupon / claim code (optional)</Label>
                      <Input
                        id="offer-code"
                        value={offer.code}
                        onChange={(e) => {
                          setOffer({ ...offer, code: e.target.value });
                          setExtraDirty(true);
                        }}
                        placeholder="MNKP500"
                        className="h-10 font-mono uppercase"
                        maxLength={80}
                      />
                      {offer.code ? (
                        <p className="text-xs text-muted-foreground">Buyers get a one-tap copy button on the product page.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="offer-title">Headline</Label>
                    <Input
                      id="offer-title"
                      value={offer.title}
                      onChange={(e) => {
                        setOffer({ ...offer, title: e.target.value });
                        setExtraDirty(true);
                      }}
                      placeholder="Extra ₹500 off for MN.KP readers"
                      className="h-10"
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground">{offer.title.length}/200 characters</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="offer-description">Details (optional)</Label>
                    <Textarea
                      id="offer-description"
                      value={offer.description}
                      onChange={(e) => {
                        setOffer({ ...offer, description: e.target.value });
                        setExtraDirty(true);
                      }}
                      placeholder="How the offer works, when it applies, how buyers claim it..."
                      rows={3}
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground">{offer.description.length}/2000 characters</p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="offer-starts">Starts (optional)</Label>
                      <Input
                        id="offer-starts"
                        type="datetime-local"
                        value={offer.startsAt}
                        onChange={(e) => {
                          setOffer({ ...offer, startsAt: e.target.value });
                          setExtraDirty(true);
                        }}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offer-ends">Ends (optional)</Label>
                      <Input
                        id="offer-ends"
                        type="datetime-local"
                        value={offer.endsAt}
                        onChange={(e) => {
                          setOffer({ ...offer, endsAt: e.target.value });
                          setExtraDirty(true);
                        }}
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">Empty start/end = runs until you switch it off.</p>
                    </div>
                  </div>
                </CardContent>
              ) : null}
            </Card>

            {/* Media — direct uploads (Task 13-a) + quick picks */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Media</CardTitle>
                <CardDescription>
                  Upload from your device — every image is auto-optimized to WebP
                  (resize + re-encode in your browser) before it is stored.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Main image</FormLabel>
                      <FormControl>
                        <SingleImageField
                          value={field.value ?? ""}
                          onChange={(url) => {
                            field.onChange(url);
                            setExtraDirty(true);
                          }}
                          label="Main image"
                          aspect="aspect-square"
                        />
                      </FormControl>
                      <FormDescription>Library quick picks:</FormDescription>
                      <div className="flex flex-wrap gap-2">
                        {STORE_IMAGES.map((src) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() => {
                              field.onChange(src);
                              setExtraDirty(true);
                            }}
                            aria-label={`Use image ${src}`}
                            className={`size-14 overflow-hidden rounded-md border-2 transition-transform hover:scale-105 ${field.value === src ? "border-gold" : "border-transparent"
                              }`}
                          >
                            <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Gallery — extra angles (Flipkart/Amazon style)</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Visitors swipe through these on the product page (pinch-zoom
                    lightbox included). Drag thumbnails to reorder; the star button
                    promotes an image to the main slot. Add as many as you need —
                    up to {PRODUCT_GALLERY_MAX}.
                  </p>
                  <GalleryField
                    value={gallery}
                    onChange={(urls) => {
                      setGallery(urls);
                      setExtraDirty(true);
                    }}
                    max={PRODUCT_GALLERY_MAX}
                    onMakeMain={(url) => {
                      form.setValue("imageUrl", url, { shouldDirty: true });
                      setGallery(gallery.filter((s) => s !== url));
                      setExtraDirty(true);
                      toast({ title: "Main image set", description: "Removed from the gallery to avoid a duplicate." });
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Review verdict */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Review verdict</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <FormLabel>Rating</FormLabel>
                    <span className="flex items-center gap-2">
                      <Stars rating={rating} size="md" />
                      <span className="text-sm font-medium tabular-nums">{rating.toFixed(1)} / 5</span>
                    </span>
                  </div>
                  <Slider
                    value={[rating]}
                    min={0}
                    max={5}
                    step={0.1}
                    onValueChange={([v]) => {
                      setRating(v);
                      setExtraDirty(true);
                    }}
                    aria-label="Product rating"
                    className="mt-3"
                  />
                </div>

                <FormField
                  control={form.control}
                  name="reviewCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Review count</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} inputMode="numeric" placeholder="0" className="h-10 sm:max-w-[200px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <FormLabel>Pros</FormLabel>
                    <p className="mb-2 text-xs text-muted-foreground">What earns the recommendation</p>
                    {rowEditor(pros, setPros, "Pro", "Great noise cancelling...")}
                  </div>
                  <div>
                    <FormLabel>Cons</FormLabel>
                    <p className="mb-2 text-xs text-muted-foreground">The honest trade-offs</p>
                    {rowEditor(cons, setCons, "Con", "Pricey for casual listeners...")}
                  </div>
                </div>

                <div>
                  <FormLabel>Key specs</FormLabel>
                  <p className="mb-2 text-xs text-muted-foreground">Label → value rows shown on the product page</p>
                  <div className="space-y-2">
                    {keySpecs.map((row, i) => (
                      <div key={`spec-${i}`} className="flex gap-2">
                        <Input
                          value={row.key}
                          onChange={(e) => {
                            const next = [...keySpecs];
                            next[i] = { ...next[i], key: e.target.value };
                            setKeySpecs(next);
                            setExtraDirty(true);
                          }}
                          placeholder="Battery"
                          aria-label={`Spec label ${i + 1}`}
                          className="h-10 sm:max-w-[180px]"
                        />
                        <Input
                          value={row.value}
                          onChange={(e) => {
                            const next = [...keySpecs];
                            next[i] = { ...next[i], value: e.target.value };
                            setKeySpecs(next);
                            setExtraDirty(true);
                          }}
                          placeholder="30 hours ANC on"
                          aria-label={`Spec value ${i + 1}`}
                          className="h-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setKeySpecs(keySpecs.filter((_, idx) => idx !== i));
                            setExtraDirty(true);
                          }}
                          aria-label={`Remove spec ${i + 1}`}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2"
                      onClick={() => {
                        setKeySpecs([...keySpecs, { key: "", value: "" }]);
                        setExtraDirty(true);
                      }}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Add spec
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ---------------- side column ---------------- */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <AiAssistCard
              subline="Draft an honest review from the specs"
              actions={[{ action: "description", label: "Draft review" }]}
              buildRequest={buildAiRequest}
              applyResult={applyAiResult}
              confirmFor={aiConfirmFor}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Listing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Uncategorized" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(categories.data ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Featured</FormLabel>
                        <p className="text-xs text-muted-foreground">Rotates into the sponsored ad slots</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {productQuery.data ? (
                  <div className="space-y-1 rounded-lg border p-3 text-xs text-muted-foreground">
                    <p>Clicks: <span className="font-medium text-foreground">{formatCompact(productQuery.data.clicksCount)}</span></p>
                    <p>Created: {fmtDate(productQuery.data.createdAt)}</p>
                  </div>
                ) : null}

                <Button type="submit" className="h-10 w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : isNew ? "Create product" : "Save changes"}
                </Button>
              </CardContent>
            </Card>

            {/* Live ProductCard preview */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                Live card preview
              </p>
              <ProductCard
                product={{
                  slug: effectiveSlug || "preview",
                  name: watched.name || "Product name",
                  tagline: watched.tagline || null,
                  image: watched.imageUrl || null,
                  price: priceNum,
                  compareAtPrice: compareNum || null,
                  rating,
                  merchant: watched.merchant || null,
                  offerLabel: offer.active ? offer.title || "Special offer" : null,
                }}
              />
            </div>
          </div>
        </form>
      </Form>
    </AdminShell>
  );
}
