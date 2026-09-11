"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Save,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import type { JsonRecord, StatsResponse } from "@/types";
import { cn } from "@/lib/utils";
import { AdminShell } from "./_shell";
import { apiFetch, formatUptime, useAdminGuard } from "./_shared";

/**
 * Settings (#/admin/settings — route key "admin-settings").
 * Tabs: Brand / Footer / Media & Decor / Ads / Maintenance / System.
 * Loads /api/settings/all; per-tab Save → PATCH /api/settings/:key, then
 * invalidates the PUBLIC settings query (queryKey ["settings"] — shared
 * with the whole shell via use-settings) so header/footer/ads/maintenance
 * react instantly.
 */

/* ------------------------------------------------------------------ */
/* draft shapes                                                        */
/* ------------------------------------------------------------------ */

interface SocialRow {
  key: string;
  url: string;
}
interface LinkRow {
  label: string;
  href: string;
}
interface ColumnDraft {
  title: string;
  links: LinkRow[];
}
interface StickerDraft {
  type: string;
  value: string;
  corner: string;
}

interface BrandDraft {
  siteName: string;
  ownerName: string;
  roleLine: string;
  tagline: string;
  email: string;
  phone: string;
  whatsappUrl: string;
  address: string;
  cvUrl: string;
  socials: SocialRow[];
}

interface FooterDraft {
  tagline: string;
  copyright: string;
  socialsEnabled: boolean;
  columns: ColumnDraft[];
}

interface MediaDraft {
  heroEnabled: boolean;
  heroImages: string[];
  stickersEnabled: boolean;
  stickerItems: StickerDraft[];
  gifsEnabled: boolean;
  gifs: string[];
}

interface AdsDraft {
  enabled: boolean;
  placements: string[];
}

interface MaintenanceDraft {
  enabled: boolean;
  message: string;
  estimatedEnd: string;
}

/* ------------------------------------------------------------------ */
/* JSON readers                                                        */
/* ------------------------------------------------------------------ */

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asRecord(v: unknown): Record<string, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

/* Sticker emoji palette — these ARE sticker admin-data values (the single
 * sanctioned exception to the no-emoji-in-source rule per BUILD CONTRACT
 * §0 + task spec). */
const STICKER_PALETTE = ["🚀", "✨", "⭐", "🔥", "💡", "🎯", "🏆", "💎", "🌟", "⚡"];

const AD_PLACEMENTS = [
  { value: "blog-inline", label: "Blog — inline (mid-article)" },
  { value: "blog-sidebar", label: "Blog — sidebar rail" },
  { value: "home-strip", label: "Home — strip" },
  { value: "store-side", label: "Store — side panel" },
];

const SOCIAL_KEYS = [
  "WhatsApp",
  "Instagram",
  "LinkedIn",
  "X",
  "Facebook",
  "Threads",
  "Pinterest",
  "Google Business",
];

type SettingKey = "brand" | "footer" | "media" | "ads" | "maintenance";

export default function SettingsView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiFetch<Record<string, JsonRecord>>("/api/settings/all"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const healthQuery = useQuery({
    queryKey: ["admin-health"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/health");
        const json = (await res.json()) as { ok: boolean; data?: { uptime?: number; time?: string } };
        return json.data ?? null;
      } catch {
        return null;
      }
    },
    enabled: allowed,
    refetchInterval: 30_000,
    retry: 0,
  });

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch<StatsResponse>("/api/stats"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  /* drafts */
  const [brand, setBrand] = React.useState<BrandDraft | null>(null);
  const [footer, setFooter] = React.useState<FooterDraft | null>(null);
  const [media, setMedia] = React.useState<MediaDraft | null>(null);
  const [ads, setAds] = React.useState<AdsDraft | null>(null);
  const [maintenance, setMaintenance] = React.useState<MaintenanceDraft | null>(null);
  const [dirty, setDirty] = React.useState<Record<string, boolean>>({});
  const [maintenanceConfirm, setMaintenanceConfirm] = React.useState(false);
  const [newImage, setNewImage] = React.useState("");
  const [newGif, setNewGif] = React.useState("");

  React.useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    const b = data.brand ?? {};
    const f = data.footer ?? {};
    const m = data.media ?? {};
    const a = data.ads ?? {};
    const mt = data.maintenance ?? {};

    const hero = (m.heroMarquee ?? {}) as Record<string, unknown>;
    const stickers = (m.stickers ?? {}) as Record<string, unknown>;
    const gifBlock = (m.blogGifs ?? {}) as Record<string, unknown>;

    setBrand({
      siteName: asString(b.siteName),
      ownerName: asString(b.ownerName),
      roleLine: asString(b.roleLine),
      tagline: asString(b.tagline),
      email: asString(b.email),
      phone: asString(b.phone),
      whatsappUrl: asString(b.whatsappUrl),
      address: asString(b.address),
      cvUrl: asString(b.cvUrl),
      socials: Object.entries(asRecord(b.socials)).map(([key, url]) => ({ key, url })),
    });
    setFooter({
      tagline: asString(f.tagline),
      copyright: asString(f.copyright),
      socialsEnabled: asBool(f.socialsEnabled, true),
      columns: Array.isArray(f.columns)
        ? (f.columns as unknown[]).map((c) => {
            const col = (c ?? {}) as { title?: unknown; links?: unknown };
            return {
              title: asString(col.title, "Column"),
              links: Array.isArray(col.links)
                ? (col.links as unknown[]).map((l) => {
                    const link = (l ?? {}) as { label?: unknown; href?: unknown };
                    return { label: asString(link.label), href: asString(link.href) };
                  })
                : [],
            };
          })
        : [],
    });
    setMedia({
      heroEnabled: asBool(hero.enabled),
      heroImages: asStrArr(hero.images),
      stickersEnabled: asBool(stickers.enabled),
      stickerItems: Array.isArray(stickers.items)
        ? (stickers.items as unknown[]).map((s) => {
            const item = (s ?? {}) as { type?: unknown; value?: unknown; corner?: unknown };
            return {
              type: asString(item.type, "emoji"),
              value: asString(item.value),
              corner: asString(item.corner, "br"),
            };
          })
        : [],
      gifsEnabled: asBool(gifBlock.enabled),
      gifs: asStrArr(gifBlock.gifs),
    });
    setAds({ enabled: asBool(a.enabled, true), placements: asStrArr(a.placements) });
    setMaintenance({
      enabled: asBool(mt.enabled),
      message: asString(mt.message),
      estimatedEnd: asString(mt.estimatedEnd),
    });
    setDirty({});
  }, [settingsQuery.data]);

  const touch = (key: string) => setDirty((d) => ({ ...d, [key]: true }));

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: SettingKey; value: Record<string, unknown> }) =>
      apiFetch(`/api/settings/${key}`, { method: "PATCH", body: JSON.stringify({ value }) }),
    onSuccess: (_data, variables) => {
      toast({
        title: "Settings saved",
        description: `${variables.key.charAt(0).toUpperCase() + variables.key.slice(1)} updated — the live site picked it up.`,
      });
      setDirty((d) => ({ ...d, [variables.key]: false }));
      // CRITICAL: the PUBLIC settings query the whole shell reads
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading settings" />;
  if (!allowed) return <ForbiddenState />;

  const buildBrandValue = (): Record<string, unknown> => ({
    siteName: brand?.siteName ?? "",
    ownerName: brand?.ownerName ?? "",
    roleLine: brand?.roleLine ?? "",
    tagline: brand?.tagline ?? "",
    email: brand?.email ?? "",
    phone: brand?.phone ?? "",
    whatsappUrl: brand?.whatsappUrl ?? "",
    address: brand?.address ?? "",
    cvUrl: brand?.cvUrl ?? "",
    socials: Object.fromEntries(
      (brand?.socials ?? [])
        .filter((s) => s.key.trim())
        .map((s) => [s.key.trim(), s.url.trim()])
    ),
  });

  const buildFooterValue = (): Record<string, unknown> => ({
    tagline: footer?.tagline ?? "",
    copyright: footer?.copyright ?? "",
    socialsEnabled: footer?.socialsEnabled ?? true,
    columns: (footer?.columns ?? []).map((c) => ({
      title: c.title,
      links: c.links.filter((l) => l.label.trim()),
    })),
  });

  const buildMediaValue = (): Record<string, unknown> => ({
    heroMarquee: { enabled: media?.heroEnabled ?? false, images: media?.heroImages ?? [] },
    stickers: { enabled: media?.stickersEnabled ?? false, items: media?.stickerItems ?? [] },
    blogGifs: { enabled: media?.gifsEnabled ?? false, gifs: media?.gifs ?? [] },
  });

  const buildAdsValue = (): Record<string, unknown> => ({
    enabled: ads?.enabled ?? true,
    placements: ads?.placements ?? [],
  });

  const buildMaintenanceValue = (): Record<string, unknown> => ({
    enabled: maintenance?.enabled ?? false,
    message: maintenance?.message ?? "",
    estimatedEnd: maintenance?.estimatedEnd?.trim() || null,
  });

  const saveTab = (key: SettingKey, value: Record<string, unknown>) =>
    saveMutation.mutate({ key, value });

  const SaveButton = ({ tab, build }: { tab: SettingKey; build: () => Record<string, unknown> }) => (
    <Button
      size="sm"
      className="h-9 gap-2"
      disabled={!dirty[tab] || saveMutation.isPending}
      onClick={() => saveTab(tab, build())}
    >
      <Save className="size-4" aria-hidden="true" />
      {saveMutation.isPending ? "Saving..." : dirty[tab] ? "Save changes" : "Saved"}
    </Button>
  );

  const dirtyChip = (tab: string) =>
    dirty[tab] ? (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        Unsaved
      </Badge>
    ) : null;

  return (
    <AdminShell title="Settings" description="Total control — brand, footer, decor, ads and maintenance.">
      <SEOHead title="Settings — Admin & Developer | MN.KP" noindex />

      <DataState query={settingsQuery} skeletonRows={6} empty={false}>
        {() => (
          <Tabs defaultValue="brand" className="space-y-6">
            <TabsList className="h-11 w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="brand" className="h-9">Brand</TabsTrigger>
              <TabsTrigger value="footer" className="h-9">Footer</TabsTrigger>
              <TabsTrigger value="media" className="h-9">Media &amp; Decor</TabsTrigger>
              <TabsTrigger value="ads" className="h-9">Ads</TabsTrigger>
              <TabsTrigger value="maintenance" className="h-9">Maintenance</TabsTrigger>
              <TabsTrigger value="system" className="h-9">System</TabsTrigger>
            </TabsList>

            {/* ------------------------- BRAND ------------------------- */}
            <TabsContent value="brand" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Brand identity</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("brand")}
                  <SaveButton tab="brand" build={buildBrandValue} />
                </div>
              </div>
              {brand ? (
                <Card>
                  <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="b-site">Site name</Label>
                      <Input id="b-site" value={brand.siteName} onChange={(e) => { setBrand({ ...brand, siteName: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-owner">Owner name</Label>
                      <Input id="b-owner" value={brand.ownerName} onChange={(e) => { setBrand({ ...brand, ownerName: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-role">Role line</Label>
                      <Input id="b-role" value={brand.roleLine} onChange={(e) => { setBrand({ ...brand, roleLine: e.target.value }); touch("brand"); }} placeholder="Freelancer · Businessman · AI-First Developer" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-email">Email</Label>
                      <Input id="b-email" type="email" value={brand.email} onChange={(e) => { setBrand({ ...brand, email: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-phone">Phone</Label>
                      <Input id="b-phone" value={brand.phone} onChange={(e) => { setBrand({ ...brand, phone: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-wa">WhatsApp URL</Label>
                      <Input id="b-wa" value={brand.whatsappUrl} onChange={(e) => { setBrand({ ...brand, whatsappUrl: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-address">Address</Label>
                      <Input id="b-address" value={brand.address} onChange={(e) => { setBrand({ ...brand, address: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-cv">CV URL</Label>
                      <Input id="b-cv" value={brand.cvUrl} onChange={(e) => { setBrand({ ...brand, cvUrl: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="b-tagline">Tagline</Label>
                      <Textarea id="b-tagline" value={brand.tagline} rows={2} onChange={(e) => { setBrand({ ...brand, tagline: e.target.value }); touch("brand"); }} />
                    </div>

                    <div className="space-y-3 md:col-span-2">
                      <Label>Social profiles</Label>
                      {brand.socials.map((row, i) => (
                        <div key={`social-${i}`} className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={row.key}
                            list="social-keys"
                            onChange={(e) => {
                              const next = [...brand.socials];
                              next[i] = { ...next[i], key: e.target.value };
                              setBrand({ ...brand, socials: next });
                              touch("brand");
                            }}
                            placeholder="Platform"
                            aria-label={`Social platform ${i + 1}`}
                            className="sm:max-w-[180px]"
                          />
                          <Input
                            value={row.url}
                            onChange={(e) => {
                              const next = [...brand.socials];
                              next[i] = { ...next[i], url: e.target.value };
                              setBrand({ ...brand, socials: next });
                              touch("brand");
                            }}
                            placeholder="https://..."
                            aria-label={`Social URL ${i + 1}`}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setBrand({ ...brand, socials: brand.socials.filter((_, idx) => idx !== i) });
                              touch("brand");
                            }}
                            aria-label={`Remove social ${i + 1}`}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <datalist id="social-keys">
                        {SOCIAL_KEYS.map((k) => (
                          <option key={k} value={k} />
                        ))}
                      </datalist>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2"
                        onClick={() => {
                          setBrand({ ...brand, socials: [...brand.socials, { key: "", url: "" }] });
                          touch("brand");
                        }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Add social profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* ------------------------- FOOTER ------------------------- */}
            <TabsContent value="footer" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Footer</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("footer")}
                  <SaveButton tab="footer" build={buildFooterValue} />
                </div>
              </div>
              {footer ? (
                <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                  <Card>
                    <CardContent className="space-y-5 pt-6">
                      <div className="space-y-2">
                        <Label htmlFor="f-tagline">Tagline</Label>
                        <Textarea id="f-tagline" value={footer.tagline} rows={2} onChange={(e) => { setFooter({ ...footer, tagline: e.target.value }); touch("footer"); }} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="f-copyright">Copyright line</Label>
                        <Input id="f-copyright" value={footer.copyright} onChange={(e) => { setFooter({ ...footer, copyright: e.target.value }); touch("footer"); }} />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">Social icons row</p>
                          <p className="text-xs text-muted-foreground">Show the socials row under the columns</p>
                        </div>
                        <Switch
                          checked={footer.socialsEnabled}
                          onCheckedChange={(v) => { setFooter({ ...footer, socialsEnabled: v }); touch("footer"); }}
                          aria-label="Toggle socials row"
                        />
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <Label>Columns</Label>
                        {footer.columns.map((col, ci) => (
                          <div key={`col-${ci}`} className="space-y-2 rounded-lg border p-3">
                            <div className="flex gap-2">
                              <Input
                                value={col.title}
                                onChange={(e) => {
                                  const next = [...footer.columns];
                                  next[ci] = { ...col, title: e.target.value };
                                  setFooter({ ...footer, columns: next });
                                  touch("footer");
                                }}
                                placeholder="Column title"
                                aria-label={`Column ${ci + 1} title`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setFooter({ ...footer, columns: footer.columns.filter((_, idx) => idx !== ci) });
                                  touch("footer");
                                }}
                                aria-label={`Remove column ${ci + 1}`}
                              >
                                <X className="size-4" aria-hidden="true" />
                              </Button>
                            </div>
                            {col.links.map((link, li) => (
                              <div key={`link-${ci}-${li}`} className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                  value={link.label}
                                  onChange={(e) => {
                                    const next = [...footer.columns];
                                    next[ci] = {
                                      ...col,
                                      links: col.links.map((l, idx) =>
                                        idx === li ? { ...l, label: e.target.value } : l
                                      ),
                                    };
                                    setFooter({ ...footer, columns: next });
                                    touch("footer");
                                  }}
                                  placeholder="Label"
                                  aria-label={`Column ${ci + 1} link ${li + 1} label`}
                                  className="sm:max-w-[200px]"
                                />
                                <Input
                                  value={link.href}
                                  onChange={(e) => {
                                    const next = [...footer.columns];
                                    next[ci] = {
                                      ...col,
                                      links: col.links.map((l, idx) =>
                                        idx === li ? { ...l, href: e.target.value } : l
                                      ),
                                    };
                                    setFooter({ ...footer, columns: next });
                                    touch("footer");
                                  }}
                                  placeholder="#/blog or https://..."
                                  aria-label={`Column ${ci + 1} link ${li + 1} URL`}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    const next = [...footer.columns];
                                    next[ci] = { ...col, links: col.links.filter((_, idx) => idx !== li) };
                                    setFooter({ ...footer, columns: next });
                                    touch("footer");
                                  }}
                                  aria-label={`Remove link ${li + 1}`}
                                >
                                  <X className="size-4" aria-hidden="true" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => {
                                const next = [...footer.columns];
                                next[ci] = { ...col, links: [...col.links, { label: "", href: "" }] };
                                setFooter({ ...footer, columns: next });
                                touch("footer");
                              }}
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                              Add link
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2"
                          onClick={() => {
                            setFooter({ ...footer, columns: [...footer.columns, { title: "", links: [] }] });
                            touch("footer");
                          }}
                        >
                          <Plus className="size-4" aria-hidden="true" />
                          Add column
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* live footer preview */}
                  <Card className="h-fit bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Live preview</CardTitle>
                      <CardDescription>Rough render of the saved footer</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div>
                        <p className="font-semibold">MN.KP</p>
                        <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                          {footer.tagline || "Tagline goes here..."}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {footer.columns.map((col, i) => (
                          <div key={`preview-col-${i}`}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {col.title || "Untitled"}
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {col.links.map((l, li) => (
                                <li key={`preview-link-${li}`} className="truncate text-xs text-foreground/70">
                                  {l.label || "Link"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      {footer.socialsEnabled ? (
                        <p className="text-xs text-muted-foreground">+ social icons row</p>
                      ) : null}
                      <Separator />
                      <p className="text-[11px] text-muted-foreground">
                        {footer.copyright || "Copyright line"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>

            {/* ------------------------- MEDIA & DECOR ------------------------- */}
            <TabsContent value="media" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Media &amp; decor</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("media")}
                  <SaveButton tab="media" build={buildMediaValue} />
                </div>
              </div>
              {media ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* hero marquee */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Hero marquee</CardTitle>
                        <Switch
                          checked={media.heroEnabled}
                          onCheckedChange={(v) => { setMedia({ ...media, heroEnabled: v }); touch("media"); }}
                          aria-label="Toggle hero marquee"
                        />
                      </div>
                      <CardDescription>Image strip on the home hero</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {media.heroImages.map((img, i) => (
                        <div key={`hero-${i}`} className="flex items-center gap-2">
                          <img src={img} alt="" loading="lazy" decoding="async" className="size-10 shrink-0 rounded-md border object-cover" />
                          <Input
                            value={img}
                            onChange={(e) => {
                              const next = [...media.heroImages];
                              next[i] = e.target.value;
                              setMedia({ ...media, heroImages: next });
                              touch("media");
                            }}
                            aria-label={`Marquee image ${i + 1}`}
                            className="flex-1 font-mono text-xs"
                          />
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-9"
                              disabled={i === 0}
                              onClick={() => {
                                const next = [...media.heroImages];
                                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                setMedia({ ...media, heroImages: next });
                                touch("media");
                              }}
                              aria-label={`Move image ${i + 1} up`}
                            >
                              <ArrowUp className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-9"
                              disabled={i === media.heroImages.length - 1}
                              onClick={() => {
                                const next = [...media.heroImages];
                                [next[i + 1], next[i]] = [next[i], next[i + 1]];
                                setMedia({ ...media, heroImages: next });
                                touch("media");
                              }}
                              aria-label={`Move image ${i + 1} down`}
                            >
                              <ArrowDown className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setMedia({ ...media, heroImages: media.heroImages.filter((_, idx) => idx !== i) });
                                touch("media");
                              }}
                              aria-label={`Remove image ${i + 1}`}
                            >
                              <X className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          value={newImage}
                          onChange={(e) => setNewImage(e.target.value)}
                          placeholder="/images/blog/... (add image URL)"
                          aria-label="New marquee image URL"
                          className="h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10"
                          onClick={() => {
                            const url = newImage.trim();
                            if (!url || media.heroImages.includes(url)) return;
                            setMedia({ ...media, heroImages: [...media.heroImages, url] });
                            setNewImage("");
                            touch("media");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* stickers */}
                  <Card className="border-gold/40">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sparkles className="size-4 text-gold" aria-hidden="true" />
                          Corner stickers
                        </CardTitle>
                        <Switch
                          checked={media.stickersEnabled}
                          onCheckedChange={(v) => { setMedia({ ...media, stickersEnabled: v }); touch("media"); }}
                          aria-label="Toggle corner stickers"
                        />
                      </div>
                      <CardDescription>
                        Floating decor on every page — emoji characters or image/GIF URLs
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {media.stickerItems.map((st, i) => (
                        <div key={`sticker-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                          <span className="flex size-10 items-center justify-center rounded-md bg-muted text-2xl leading-none">
                            {st.value.startsWith("http") || st.value.startsWith("/") ? (
                              <img src={st.value} alt="" className="h-8 w-auto" />
                            ) : (
                              st.value || "?"
                            )}
                          </span>
                          <Input
                            value={st.value}
                            onChange={(e) => {
                              const next = [...media.stickerItems];
                              next[i] = { ...st, value: e.target.value, type: e.target.value.startsWith("http") || e.target.value.startsWith("/") ? "image" : "emoji" };
                              setMedia({ ...media, stickerItems: next });
                              touch("media");
                            }}
                            placeholder="Emoji or image URL"
                            aria-label={`Sticker ${i + 1} value`}
                            className="h-9 min-w-0 flex-1 font-mono text-xs"
                          />
                          <Select
                            value={st.corner}
                            onValueChange={(v) => {
                              const next = [...media.stickerItems];
                              next[i] = { ...st, corner: v };
                              setMedia({ ...media, stickerItems: next });
                              touch("media");
                            }}
                          >
                            <SelectTrigger className="h-9 w-[90px] text-xs" aria-label={`Sticker ${i + 1} corner`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tl">top-left</SelectItem>
                              <SelectItem value="tr">top-right</SelectItem>
                              <SelectItem value="bl">bottom-left</SelectItem>
                              <SelectItem value="br">bottom-right</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setMedia({ ...media, stickerItems: media.stickerItems.filter((_, idx) => idx !== i) });
                              touch("media");
                            }}
                            aria-label={`Remove sticker ${i + 1}`}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-xs text-muted-foreground">Quick emoji:</span>
                        {STICKER_PALETTE.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setMedia({ ...media, stickerItems: [...media.stickerItems, { type: "emoji", value: emoji, corner: "br" }] });
                              touch("media");
                            }}
                            aria-label={`Add ${emoji} sticker`}
                            className="flex size-9 items-center justify-center rounded-md border bg-muted/50 text-xl transition-transform hover:scale-110"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2"
                        onClick={() => {
                          setMedia({ ...media, stickerItems: [...media.stickerItems, { type: "emoji", value: "", corner: "br" }] });
                          touch("media");
                        }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Add sticker
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Corners sit clear of the header and mobile tab bar; staff see them on the live site too.
                      </p>
                    </CardContent>
                  </Card>

                  {/* blog gifs */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Blog GIFs</CardTitle>
                        <Switch
                          checked={media.gifsEnabled}
                          onCheckedChange={(v) => { setMedia({ ...media, gifsEnabled: v }); touch("media"); }}
                          aria-label="Toggle blog gifs"
                        />
                      </div>
                      <CardDescription>Animated accents dropped into blog articles</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {media.gifs.map((gif, i) => (
                        <div key={`gif-${i}`} className="flex items-center gap-2">
                          <img src={gif} alt="" loading="lazy" decoding="async" className="h-10 w-auto shrink-0 rounded-md border" />
                          <Input
                            value={gif}
                            onChange={(e) => {
                              const next = [...media.gifs];
                              next[i] = e.target.value;
                              setMedia({ ...media, gifs: next });
                              touch("media");
                            }}
                            aria-label={`GIF ${i + 1} URL`}
                            className="flex-1 font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setMedia({ ...media, gifs: media.gifs.filter((_, idx) => idx !== i) });
                              touch("media");
                            }}
                            aria-label={`Remove GIF ${i + 1}`}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          value={newGif}
                          onChange={(e) => setNewGif(e.target.value)}
                          placeholder="https://...gif (add GIF URL)"
                          aria-label="New GIF URL"
                          className="h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10"
                          onClick={() => {
                            const url = newGif.trim();
                            if (!url || media.gifs.includes(url)) return;
                            setMedia({ ...media, gifs: [...media.gifs, url] });
                            setNewGif("");
                            touch("media");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>

            {/* ------------------------- ADS ------------------------- */}
            <TabsContent value="ads" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Affiliate ads</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("ads")}
                  <SaveButton tab="ads" build={buildAdsValue} />
                </div>
              </div>
              {ads ? (
                <Card>
                  <CardContent className="space-y-5 pt-6">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Sponsored ad slots</p>
                        <p className="text-xs text-muted-foreground">
                          Featured products rotate through enabled placements (gold dashed cards)
                        </p>
                      </div>
                      <Switch
                        checked={ads.enabled}
                        onCheckedChange={(v) => { setAds({ ...ads, enabled: v }); touch("ads"); }}
                        aria-label="Toggle affiliate ads"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {AD_PLACEMENTS.map((p) => (
                        <label
                          key={p.value}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50",
                            ads.placements.includes(p.value) && "border-gold/40 bg-gold/[0.04]"
                          )}
                        >
                          <Checkbox
                            checked={ads.placements.includes(p.value)}
                            onCheckedChange={(checked) => {
                              setAds({
                                ...ads,
                                placements: checked
                                  ? [...ads.placements, p.value]
                                  : ads.placements.filter((x) => x !== p.value),
                              });
                              touch("ads");
                            }}
                            aria-label={`Enable ${p.label} placement`}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      At least one placement stays enabled — the resolver falls back to all four when the list is empty.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* ------------------------- MAINTENANCE ------------------------- */}
            <TabsContent value="maintenance" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Maintenance mode</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("maintenance")}
                  <SaveButton tab="maintenance" build={buildMaintenanceValue} />
                </div>
              </div>
              {maintenance ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className={maintenance.enabled ? "border-amber-500/50" : undefined}>
                    <CardContent className="space-y-5 pt-6">
                      <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <Wrench className="size-4 text-amber-500" aria-hidden="true" />
                            Maintenance mode
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Guests see the maintenance page; staff bypass with a gold banner
                          </p>
                        </div>
                        <Switch
                          checked={maintenance.enabled}
                          onCheckedChange={(v) => {
                            if (v) setMaintenanceConfirm(true);
                            else {
                              setMaintenance({ ...maintenance, enabled: false });
                              touch("maintenance");
                            }
                          }}
                          aria-label="Toggle maintenance mode"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-message">Message</Label>
                        <Textarea
                          id="m-message"
                          value={maintenance.message}
                          rows={3}
                          onChange={(e) => { setMaintenance({ ...maintenance, message: e.target.value }); touch("maintenance"); }}
                          placeholder="We are performing scheduled maintenance. Back shortly."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-end">Estimated end (shown as a chip)</Label>
                        <Input
                          id="m-end"
                          value={maintenance.estimatedEnd}
                          onChange={(e) => { setMaintenance({ ...maintenance, estimatedEnd: e.target.value }); touch("maintenance"); }}
                          placeholder="e.g. 11:30 PM IST tonight"
                        />
                      </div>
                      <p className="flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/[0.04] p-3 text-xs text-muted-foreground">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                        Staff bypass: signed-in editors and admins keep full access while maintenance is on —
                        you can browse and test safely before flipping it off.
                      </p>
                    </CardContent>
                  </Card>

                  {/* preview */}
                  <Card className="h-fit bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Guest preview</CardTitle>
                      <CardDescription>What visitors will see</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-6 text-center">
                        <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10">
                          <Wrench className="size-6 text-amber-500" aria-hidden="true" />
                        </span>
                        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                          MAINTENANCE
                        </p>
                        <p className="mt-2 text-lg font-semibold">MN.KP is being polished</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {maintenance.message || "We are performing scheduled maintenance. Back shortly."}
                        </p>
                        {maintenance.estimatedEnd ? (
                          <p className="mt-3 inline-block rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
                            Estimated back by {maintenance.estimatedEnd}
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>

            {/* ------------------------- SYSTEM ------------------------- */}
            <TabsContent value="system" className="space-y-4">
              <h2 className="text-base font-semibold">System</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="size-4 text-primary" aria-hidden="true" />
                      Service health
                    </CardTitle>
                    <CardDescription>GET /api/health · refreshes 30s</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <span className="flex size-2 rounded-full bg-primary" aria-hidden="true" />
                      API responding
                      {healthQuery.isPending ? " (checking...)" : ""}
                    </p>
                    <p className="text-muted-foreground">
                      Uptime: {healthQuery.data ? formatUptime(healthQuery.data.uptime ?? 0) : "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Server time: {healthQuery.data?.time ? new Date(healthQuery.data.time).toLocaleString() : "—"}
                    </p>
                    <Separator className="my-3" />
                    <p className="text-xs text-muted-foreground">
                      Sandbox: Next.js dev server + Prisma SQLite (db/custom.db). Production target: Neon/Supabase
                      Postgres + Supabase Auth/Realtime.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Content counts</CardTitle>
                    <CardDescription>GET /api/stats snapshot</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsQuery.data ? (
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Users</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.totalUsers}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Posts</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.totalPosts}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Products</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.totalProducts}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Inquiries</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.totalInquiries}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Subscribers</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.subscribers}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Subscriptions</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.activeSubscriptions}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-sm text-muted-foreground">Loading stats...</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DataState>

      {/* maintenance-enable confirm */}
      <AlertDialog open={maintenanceConfirm} onOpenChange={setMaintenanceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn maintenance mode ON?</AlertDialogTitle>
            <AlertDialogDescription>
              The public site will show the maintenance page for all guests until you switch it back
              off. You (staff) keep full access with a gold banner. Remember to press Save on the
              Maintenance tab to apply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (maintenance) {
                  setMaintenance({ ...maintenance, enabled: true });
                  touch("maintenance");
                }
              }}
            >
              <Check className="mr-1 size-4" aria-hidden="true" />
              Yes, enable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
