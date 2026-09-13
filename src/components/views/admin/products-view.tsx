"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Package, Pencil, PlusCircle, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ALink } from "@/components/router/link";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { Stars, formatINR } from "@/components/shared/product-card";
import { formatCompact } from "@/components/shared/post-card";
import { toast } from "@/hooks/use-toast";
import type { Paginated, ProductDTO } from "@/types";
import { AdminShell } from "./_shell";
import {
  AdminPager,
  apiFetch,
  ConfirmAction,
  fmtDate,
  ProductStatusBadge,
  useAdminGuard,
} from "./_shared";

/**
 * Products admin (#/admin/products — route key "admin-products").
 * Staff catalog (?status=all, limit 60) filtered client-side like posts-view.
 * Per-row: edit / view / feature-toggle / delete.
 */

type StatusTab = "all" | "active" | "draft" | "archived";
const PAGE_SIZE = 10;
const FETCH_LIMIT = 60;

export default function ProductsView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [status, setStatus] = React.useState<StatusTab>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  const productsQuery = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => apiFetch<Paginated<ProductDTO>>(`/api/products?status=all&limit=${FETCH_LIMIT}`),
    enabled: allowed,
    staleTime: 15_000,
    retry: 1,
  });

  const products = React.useMemo(() => {
    const items = productsQuery.data?.items ?? [];
    const term = search.trim().toLowerCase();
    return items.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (
        term &&
        !p.name.toLowerCase().includes(term) &&
        !(p.brand ?? "").toLowerCase().includes(term) &&
        !(p.merchant ?? "").toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [productsQuery.data, status, search]);

  React.useEffect(() => {
    setPage(1);
  }, [status, search]);

  const pageItems = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const featureMutation = useMutation({
    mutationFn: (product: ProductDTO) =>
      apiFetch<ProductDTO>(`/api/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isFeatured: !product.isFeatured }),
      }),
    onSuccess: (product) => {
      toast({
        title: product.isFeatured ? "Added to featured" : "Removed from featured",
        description: product.name,
      });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (product: ProductDTO) => apiFetch(`/api/products/${product.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Product deleted", description: "The catalog entry and click history were removed." });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading products" />;
  if (!allowed) return <ForbiddenState />;

  return (
    <AdminShell
      title="Products"
      description="The affiliate store catalog — prices in INR, clicks tracked."
      actions={
        <ALink href="#/admin/products/new">
          <Button size="sm" className="h-9 gap-2">
            <PlusCircle className="size-4" aria-hidden="true" />
            Add product
          </Button>
        </ALink>
      }
    >
      <SEOHead title="Products — Admin & Developer | MN.KP" noindex />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, brand or merchant..."
            aria-label="Search products"
            className="h-10 pl-9"
          />
        </div>
        <Tabs
          value={status}
          onValueChange={(v) => setStatus(v as StatusTab)}
          aria-label="Filter by status"
        >
          <TabsList className="h-10 w-full sm:w-auto">
            <TabsTrigger value="all" className="h-8">All</TabsTrigger>
            <TabsTrigger value="active" className="h-8">Active</TabsTrigger>
            <TabsTrigger value="draft" className="h-8">Drafts</TabsTrigger>
            <TabsTrigger value="archived" className="h-8">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DataState query={productsQuery} empty={products.length === 0} emptyVariant="products" skeletonRows={6}>
        {() => (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Product</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              loading="lazy"
                              decoding="async"
                              className="size-10 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-gold/30 to-primary/20"
                            >
                              <Package className="size-4 text-foreground/60" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <ALink
                              href={`#/admin/products/${product.id}`}
                              className="block truncate font-medium hover:text-primary"
                            >
                              {product.name}
                            </ALink>
                            <p className="truncate text-xs text-muted-foreground">
                              {product.brand ?? product.merchant ?? product.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {formatINR(product.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCompact(product.clicksCount)}
                      </TableCell>
                      <TableCell>
                        <Stars rating={product.rating} showValue />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ProductStatusBadge status={product.status} />
                          {product.isFeatured ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gold">
                              Star
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <ALink href={`#/admin/products/${product.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`Edit ${product.name}`}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                          </ALink>
                          {product.status === "active" ? (
                            <ALink href={`#/store/${product.slug}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                aria-label={`View ${product.name}`}
                              >
                                <Eye className="size-4" aria-hidden="true" />
                              </Button>
                            </ALink>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            disabled={featureMutation.isPending}
                            onClick={() => featureMutation.mutate(product)}
                          >
                            {product.isFeatured ? "Unstar" : "Feature"}
                          </Button>
                          <ConfirmAction
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 text-muted-foreground hover:text-destructive"
                                aria-label={`Delete ${product.name}`}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            }
                            title="Delete this product?"
                            description={`"${product.name}" and its affiliate click history will be permanently removed.`}
                            onConfirm={() => deleteMutation.mutateAsync(product)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <AdminPager page={page} totalPages={totalPages} total={products.length} onChange={setPage} />
            <p className="text-xs text-muted-foreground">Updated records keep their slug and click history.</p>
          </div>
        )}
      </DataState>
    </AdminShell>
  );
}
