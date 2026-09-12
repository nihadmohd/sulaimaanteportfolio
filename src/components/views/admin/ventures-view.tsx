"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Layers,
  Lightbulb,
  Pencil,
  Plus,
  Rocket,
  Sparkles,
  Star,
  Trash2,
  X,
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
import { Textarea } from "@/components/ui/textarea";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { EmptyState } from "@/components/states/empty";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import type { VentureCategory, VentureDTO, VentureStatus } from "@/types";
import { AdminShell } from "./_shell";
import { apiFetch, ConfirmAction, slugify, ToneBadge, useAdminGuard } from "./_shared";

/**
 * Ventures admin (#/admin/ventures — route key "admin-ventures").
 * Create, edit and manage business ideas and ventures. KPI chips + compact
 * table; isFeatured toggles inline (PATCH {isFeatured} → audit "toggle").
 */

type Tone = "emerald" | "gold" | "amber" | "red" | "muted" | "teal";

const CATEGORY_TONE: Record<VentureCategory, Tone> = {
  venture: "gold",
  store: "teal",
  community: "emerald",
  tech: "gold",
  product: "amber",
  service: "muted",
  media: "teal",
};

const STATUS_TONE: Record<VentureStatus, Tone> = {
  live: "emerald",
  incubating: "amber",
  planned: "gold",
  idea: "muted",
  retired: "muted",
};

const CATEGORY_OPTIONS: Array<{ value: VentureCategory; label: string }> = [
  { value: "venture", label: "Venture — general / undecided" },
  { value: "store", label: "Store — retail / commerce" },
  { value: "community", label: "Community — network / local" },
  { value: "tech", label: "Tech — product / platform" },
  { value: "product", label: "Product — digital products" },
  { value: "service", label: "Service — agency / offerings" },
  { value: "media", label: "Media — content / channel" },
];

const STATUS_OPTIONS: Array<{ value: VentureStatus; label: string }> = [
  { value: "live", label: "Live — running now" },
  { value: "incubating", label: "Incubating — actively building" },
  { value: "planned", label: "Planned — next up" },
  { value: "idea", label: "Idea — exploring" },
  { value: "retired", label: "Retired — hidden from the site" },
];

/* ------------------------------------------------------------------ */
/* form state                                                          */
/* ------------------------------------------------------------------ */

interface VentureFormState {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: VentureCategory;
  status: VentureStatus;
  location: string;
  websiteUrl: string;
  imageUrl: string;
  highlights: string[];
  collabRoles: string[];
  sortOrder: string;
  isFeatured: boolean;
}

const BLANK_FORM: VentureFormState = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  category: "venture",
  status: "live",
  location: "",
  websiteUrl: "",
  imageUrl: "",
  highlights: [],
  collabRoles: [],
  sortOrder: "0",
  isFeatured: false,
};

function formFromVenture(venture: VentureDTO): VentureFormState {
  return {
    name: venture.name,
    slug: venture.slug,
    tagline: venture.tagline ?? "",
    description: venture.description ?? "",
    category: venture.category,
    status: venture.status,
    location: venture.location ?? "",
    websiteUrl: venture.websiteUrl ?? "",
    imageUrl: venture.imageUrl ?? "",
    highlights: venture.highlights,
    collabRoles: venture.collabRoles,
    sortOrder: String(venture.sortOrder),
    isFeatured: venture.isFeatured,
  };
}

function buildVentureBody(form: VentureFormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    tagline: form.tagline.trim(),
    description: form.description.trim(),
    category: form.category,
    status: form.status,
    location: form.location.trim(),
    websiteUrl: form.websiteUrl.trim(),
    imageUrl: form.imageUrl.trim(),
    highlights: form.highlights.slice(0, 8),
    collabRoles: form.collabRoles.slice(0, 8),
    sortOrder: Math.min(999, Math.max(0, Math.round(Number(form.sortOrder) || 0))),
    isFeatured: form.isFeatured,
  };
}

/* ------------------------------------------------------------------ */
/* chip input (post-edit-view tags pattern)                            */
/* ------------------------------------------------------------------ */

function ChipInput({
  id,
  label,
  placeholder,
  max,
  values,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  max: number;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = React.useState("");

  const add = () => {
    const value = input.trim().slice(0, 80);
    if (!value || values.includes(value) || values.length >= max) return;
    onChange([...values, value]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          maxLength={80}
          className="h-10"
        />
        <Button type="button" variant="outline" className="h-10" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {values.map((value) => (
            <Badge key={value} variant="secondary" className="max-w-full gap-1 truncate pr-1.5 text-xs">
              <span className="truncate">{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
                className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">None yet — press Enter after each one.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

interface VenturesAllResponse {
  items: VentureDTO[];
  total: number;
}

export default function VenturesAdminView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<VentureDTO | null>(null);
  const [form, setForm] = React.useState<VentureFormState>(BLANK_FORM);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const venturesQuery = useQuery({
    queryKey: ["admin-ventures"],
    queryFn: () => apiFetch<VenturesAllResponse>("/api/ventures?all=1"),
    enabled: allowed,
    staleTime: 15_000,
    retry: 1,
  });

  const items = venturesQuery.data?.items ?? [];

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-ventures"] });
    void queryClient.invalidateQueries({ queryKey: ["ventures"] });
  };

  const createMutation = useMutation({
    mutationFn: (state: VentureFormState) =>
      apiFetch<VentureDTO>("/api/ventures", {
        method: "POST",
        body: JSON.stringify(buildVentureBody(state)),
      }),
    onSuccess: (venture) => {
      toast({
        title: "Venture created",
        description: `${venture.name} is on the Ventures page.`,
      });
      closeDialog();
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: VentureFormState }) =>
      apiFetch<VentureDTO>(`/api/ventures/${id}`, {
        method: "PATCH",
        body: JSON.stringify(buildVentureBody(state)),
      }),
    onSuccess: (venture) => {
      toast({ title: "Venture saved", description: `${venture.name} updated.` });
      closeDialog();
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (venture: VentureDTO) =>
      apiFetch<VentureDTO>(`/api/ventures/${venture.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isFeatured: !venture.isFeatured }),
      }),
    onSuccess: (venture) => {
      toast({
        title: venture.isFeatured ? "Venture featured" : "Venture unfeatured",
        description: venture.name,
      });
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Toggle failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (venture: VentureDTO) =>
      apiFetch(`/api/ventures/${venture.id}`, { method: "DELETE" }),
    onSuccess: (_data, venture) => {
      toast({
        title: "Venture deleted",
        description: `${venture.name} removed — recover it from Activity & Undo if needed.`,
      });
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading ventures" />;
  if (!allowed) return <ForbiddenState />;

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK_FORM);
    setSlugTouched(false);
    setDialogOpen(true);
  };

  const openEdit = (venture: VentureDTO) => {
    setEditing(venture);
    setForm(formFromVenture(venture));
    setSlugTouched(true);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(BLANK_FORM);
    setSlugTouched(false);
  };

  const onNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      // auto-suggest the slug until the field is manually touched
      slug: slugTouched ? prev.slug : slugify(name),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast({
        title: "Name required",
        description: "Give the venture a name (2+ characters).",
        variant: "destructive",
      });
      return;
    }
    for (const field of [form.websiteUrl, form.imageUrl]) {
      const url = field.trim();
      if (url && !/^https?:\/\//.test(url)) {
        toast({
          title: "Invalid URL",
          description: "Website and image URLs must start with https://",
          variant: "destructive",
        });
        return;
      }
    }
    setSaving(true);
    try {
      if (editing) await updateMutation.mutateAsync({ id: editing.id, state: form });
      else await createMutation.mutateAsync(form);
    } finally {
      setSaving(false);
    }
  };

  const kpis = [
    { label: "Total", value: venturesQuery.data ? String(venturesQuery.data.total) : "—", icon: Layers },
    {
      label: "Live",
      value: venturesQuery.data
        ? String(items.filter((v) => v.status === "live").length)
        : "—",
      icon: Rocket,
    },
    {
      label: "Incubating",
      value: venturesQuery.data
        ? String(items.filter((v) => v.status === "incubating").length)
        : "—",
      icon: Lightbulb,
    },
    {
      label: "Featured",
      value: venturesQuery.data ? String(items.filter((v) => v.isFeatured).length) : "—",
      icon: Star,
    },
  ];

  return (
    <AdminShell
      title="Ventures"
      description="Create, edit and manage business ideas and ventures."
      actions={
        <Button size="sm" className="h-9 gap-2" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          New venture
        </Button>
      }
    >
      <SEOHead title="Ventures — Admin & Developer | MN.KP" noindex />

      {/* KPI chips */}
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Ventures summary">
        {kpis.map((chip) => (
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

      <DataState query={venturesQuery} empty={false} skeletonRows={6}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              title="No ventures yet"
              description="Add your first venture — Calicut Store, Chaliyam Connect, a new startup idea — and it appears on the public Ventures page instantly."
              action={
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="size-4" aria-hidden="true" />
                  Create your first venture
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%] min-w-[220px]">Venture</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Order</TableHead>
                      <TableHead className="text-center">Featured</TableHead>
                      <TableHead className="text-right">Highlights</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((venture) => (
                      <TableRow key={venture.id}>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold"
                            >
                              <Sparkles className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{venture.name}</p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                /{venture.slug}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={CATEGORY_TONE[venture.category] ?? "gold"} className="px-1.5 py-0 text-[10px] capitalize">
                            {venture.category}
                          </ToneBadge>
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={STATUS_TONE[venture.status] ?? "muted"} className="px-1.5 py-0 text-[10px] capitalize">
                            {venture.status}
                          </ToneBadge>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {venture.sortOrder}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex min-h-11 items-center justify-center">
                            <Switch
                              checked={venture.isFeatured}
                              disabled={toggleMutation.isPending && toggleMutation.variables?.id === venture.id}
                              onCheckedChange={() => toggleMutation.mutate(venture)}
                              aria-label={`${venture.isFeatured ? "Unfeature" : "Feature"} ${venture.name}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {venture.highlights.length > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Check className="size-3.5 text-gold" aria-hidden="true" />
                              {venture.highlights.length}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              onClick={() => openEdit(venture)}
                              aria-label={`Edit ${venture.name}`}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                            <ConfirmAction
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 text-muted-foreground hover:text-destructive"
                                  aria-label={`Delete ${venture.name}`}
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                              }
                              title="Delete this venture?"
                              description={`"${venture.name}" will disappear from the public Ventures page immediately. You can bring it back from Activity & Undo.`}
                              onConfirm={() => deleteMutation.mutateAsync(venture)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Sort order 0–999 — lower shows first · &ldquo;Retired&rdquo; ventures stay in this
                list but are hidden from the public page
              </p>
            </div>
          )
        }
      </DataState>

      {/* create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit venture — ${editing.name}` : "New venture"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details, status or collab roles."
                : "Add a business idea or venture — it goes live on the public Ventures page right away."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="venture-name">Name</Label>
                <Input
                  id="venture-name"
                  value={form.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Calicut Store"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venture-slug">
                  Slug <span className="text-muted-foreground">(auto from name)</span>
                </Label>
                <Input
                  id="venture-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm({ ...form, slug: e.target.value });
                  }}
                  maxLength={96}
                  placeholder="calicut-store"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venture-tagline">Tagline</Label>
              <Input
                id="venture-tagline"
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                maxLength={160}
                placeholder="One line that sells the venture"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="venture-category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as VentureCategory })}
                >
                  <SelectTrigger id="venture-category" className="h-10 w-full" aria-label="Venture category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.category === "venture" ? (
                  <p className="text-xs text-muted-foreground">Generic bucket — pick a specific one above.</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="venture-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as VentureStatus })}
                >
                  <SelectTrigger id="venture-status" className="h-10 w-full" aria-label="Venture status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="venture-location">Location</Label>
                <Input
                  id="venture-location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  maxLength={120}
                  placeholder="Calicut, Kerala"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venture-sort">Sort order (0–999)</Label>
                <Input
                  id="venture-sort"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  inputMode="numeric"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Lower shows first on the page</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="venture-website">Website URL</Label>
                <Input
                  id="venture-website"
                  value={form.websiteUrl}
                  onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  placeholder="https://..."
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venture-image">Image URL</Label>
                <Input
                  id="venture-image"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://... (optional cover)"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venture-description">
                Description <span className="text-muted-foreground">(markdown, optional)</span>
              </Label>
              <Textarea
                id="venture-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                maxLength={20_000}
                placeholder="What the venture is, who it serves, where it's heading..."
              />
            </div>

            <ChipInput
              id="venture-highlights"
              label={`Highlights (max 8)`}
              placeholder="Curated creator gear, WhatsApp-first ordering..."
              max={8}
              values={form.highlights}
              onChange={(highlights) => setForm({ ...form, highlights })}
            />

            <ChipInput
              id="venture-roles"
              label="Collab roles — looking for (max 8)"
              placeholder="Co-founder, Investor, Operations partner..."
              max={8}
              values={form.collabRoles}
              onChange={(collabRoles) => setForm({ ...form, collabRoles })}
            />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Featured</p>
                <p className="text-xs text-muted-foreground">
                  Highlights the venture with a featured chip on the public page
                </p>
              </div>
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(v) => setForm({ ...form, isFeatured: v })}
                aria-label="Toggle venture featured"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save venture" : "Create venture"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
