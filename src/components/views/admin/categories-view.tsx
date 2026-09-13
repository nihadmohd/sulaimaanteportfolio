"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import type { CategoryDTO } from "@/types";
import { AdminShell } from "./_shell";
import { apiFetch, ConfirmAction, slugify, useAdminGuard } from "./_shared";

/**
 * Categories admin (#/admin/categories — route key "admin-categories").
 * Blog/Store tabs; Add + Edit dialogs; delete warns that posts/products
 * keep their content but lose the category link (SetNull).
 */

type ScopeTab = "blog" | "store";

interface CategoryRow extends CategoryDTO {
  postCount: number;
  productCount: number;
}

interface FormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  scope: ScopeTab;
  sortOrder: string;
}

const EMPTY_FORM: FormState = { name: "", slug: "", description: "", scope: "blog", sortOrder: "0" };

export default function CategoriesView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [scope, setScope] = React.useState<ScopeTab>("blog");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories", "all"],
    queryFn: () => apiFetch<CategoryRow[]>("/api/categories"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const saveMutation = useMutation({
    mutationFn: (state: FormState) => {
      const body = {
        name: state.name,
        slug: slugTouched && state.slug ? slugify(state.slug) : undefined,
        description: state.description || undefined,
        scope: state.scope,
        sortOrder: Number(state.sortOrder || 0),
      };
      return state.id
        ? apiFetch(`/api/categories/${state.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiFetch("/api/categories", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast({
        title: form.id ? "Category updated" : "Category created",
        description: form.name,
      });
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (cat: CategoryRow) => apiFetch(`/api/categories/${cat.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Category deleted", description: "Linked posts/products were unlinked, not deleted." });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading categories" />;
  if (!allowed) return <ForbiddenState />;

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, scope });
    setSlugTouched(false);
    setDialogOpen(true);
  };

  const openEdit = (cat: CategoryRow) => {
    setForm({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      scope: cat.scope,
      sortOrder: String(cat.sortOrder),
    });
    setSlugTouched(true);
    setDialogOpen(true);
  };

  const effectiveSlug = slugTouched && form.slug ? slugify(form.slug) : slugify(form.name);
  const valid = form.name.trim().length >= 2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync(form);
    } finally {
      setSaving(false);
    }
  };

  const rows = (categoriesQuery.data ?? []).filter((c) => c.scope === scope);

  return (
    <AdminShell
      title="Categories"
      description="Shared taxonomy for the blog and the store."
      actions={
        <Button size="sm" className="h-9 gap-2" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Add category
        </Button>
      }
    >
      <SEOHead title="Categories — Admin & Developer | MN.KP" noindex />

      <Tabs value={scope} onValueChange={(v) => setScope(v as ScopeTab)} aria-label="Category scope" className="mb-4">
        <TabsList className="h-10">
          <TabsTrigger value="blog" className="h-8 px-5">Blog ({(categoriesQuery.data ?? []).filter((c) => c.scope === "blog").length})</TabsTrigger>
          <TabsTrigger value="store" className="h-8 px-5">Store ({(categoriesQuery.data ?? []).filter((c) => c.scope === "store").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataState query={categoriesQuery} empty={rows.length === 0} skeletonRows={6}>
        {() => (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead className="text-right">
                    {scope === "blog" ? "Posts" : "Products"}
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <p className="font-medium">{cat.name}</p>
                      {cat.description ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">{cat.description}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{cat.slug}</TableCell>
                    <TableCell className="tabular-nums text-sm">{cat.sortOrder}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {scope === "blog" ? cat.postCount : cat.productCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9"
                          onClick={() => openEdit(cat)}
                          aria-label={`Edit ${cat.name}`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <ConfirmAction
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${cat.name}`}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          }
                          title={`Delete "${cat.name}"?`}
                          description={`${cat.postCount} posts and ${cat.productCount} products currently use it — they will be kept but left uncategorized. This cannot be undone.`}
                          onConfirm={() => deleteMutation.mutateAsync(cat)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DataState>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>
              {form.id ? "Update the taxonomy entry." : "Create a category for blog or store content."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="AI Development"
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input
                id="cat-slug"
                value={slugTouched ? form.slug : effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: e.target.value });
                }}
                placeholder="auto-generated"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {slugTouched ? "Custom slug" : "Auto-generated from the name (editable)"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="One line shown on filter chips (optional)"
                maxLength={300}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-scope">Scope</Label>
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as ScopeTab })}>
                  <SelectTrigger id="cat-scope" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blog">Blog</SelectItem>
                    <SelectItem value="store">Store</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-sort">Sort order</Label>
                <Input
                  id="cat-sort"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || saving}>
                {saving ? "Saving..." : form.id ? "Save changes" : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
