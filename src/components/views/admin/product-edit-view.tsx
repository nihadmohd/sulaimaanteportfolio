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
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { MarkdownBlock, MarkdownFallback } from "@/components/views/shared/markdown";
import { ProductCard, Stars } from "@/components/shared/product-card";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import { useHashParams } from "@/hooks/use-hash-params";
import { navigate } from "@/hooks/use-router";
import type { ProductDTO } from "@/types";
import { AdminShell } from "./_shell";
import {
  apiFetch,
  ConfirmAction,
  fmtDate,
  formatCompact,
  formatINR,
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
  "/images/store/prod-headphones.png",
  "/images/store/prod-creator-camera.png",
  "/images/store/prod-mouse.png",
  "/images/store/prod-keyboard.png",
  "/images/store/prod-powerbank.png",
  "/images/store/prod-ssd.png",
];

const MERCHANT_SUGGESTIONS = ["Amazon", "Flipkart", "MN.KP Digital", "Croma", "Myntra", "Noise"];

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
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [galleryInput, setGalleryInput] = React.useState("");
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
    tick: JSON.stringify([watched, gallery, pros, cons, keySpecs, rating]),
    capture: () => ({ values: form.getValues(), gallery, pros, cons, keySpecs, rating }),
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
        JSON.stringify(data.cons ?? []) !== JSON.stringify(p.cons)
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

  const onSubmit = (values: ProductFormValues) => saveMutation.mutate(values);

  const addGallery = () => {
    const url = galleryInput.trim();
    if (!url || gallery.includes(url) || gallery.length >= 8) return;
    setGallery([...gallery, url]);
    setGalleryInput("");
    setExtraDirty(true);
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
                      <FormDescription>Where the Buy button sends visitors</FormDescription>
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

            {/* Media */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Media</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Main image URL</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="/images/store/... or https://..." className="h-10" />
                      </FormControl>
                      <FormDescription>Quick pick:</FormDescription>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {STORE_IMAGES.map((src) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() => {
                              field.onChange(src);
                              setExtraDirty(true);
                            }}
                            aria-label={`Use image ${src}`}
                            className={`size-14 overflow-hidden rounded-md border-2 transition-transform hover:scale-105 ${
                              field.value === src ? "border-gold" : "border-transparent"
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

                {watched.imageUrl ? (
                  <img
                    src={watched.imageUrl}
                    alt="Main image preview"
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-40 rounded-lg border object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No image yet — cards fall back to the branded gold/emerald gradient.
                  </p>
                )}

                <div>
                  <FormLabel>Gallery</FormLabel>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={galleryInput}
                      onChange={(e) => setGalleryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addGallery();
                        }
                      }}
                      placeholder="Add an image URL, press Enter (max 8)"
                      aria-label="Add gallery image"
                      className="h-10"
                    />
                    <Button type="button" variant="outline" className="h-10" onClick={addGallery}>
                      Add
                    </Button>
                  </div>
                  {gallery.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {gallery.map((src) => (
                        <div key={src} className="group relative">
                          <img
                            src={src}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-20 rounded-md border object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setGallery(gallery.filter((s) => s !== src));
                              setExtraDirty(true);
                            }}
                            aria-label={`Remove gallery image ${src}`}
                            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-destructive shadow-sm"
                          >
                            <X className="size-3" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No gallery images yet.</p>
                  )}
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
                }}
              />
            </div>
          </div>
        </form>
      </Form>
    </AdminShell>
  );
}
