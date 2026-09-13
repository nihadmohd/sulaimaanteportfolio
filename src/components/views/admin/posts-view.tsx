"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FilePlus2, Pencil, Search, Trash2 } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { formatCompact } from "@/components/shared/post-card";
import type { Paginated, PostDTO } from "@/types";
import { AdminShell } from "./_shell";
import {
  AdminPager,
  apiFetch,
  ConfirmAction,
  fmtDate,
  PostStatusBadge,
  useAdminGuard,
} from "./_shared";

/**
 * Posts admin (#/admin/posts — route key "admin-posts").
 * Staff list (?status=all) is fetched in one page (limit 60) and filtered
 * client-side (status tabs + search) so counts and pagination stay exact —
 * the public API only understands status=published|own|all.
 * Per-row: edit / view (published) / publish-toggle / delete.
 */

type StatusTab = "all" | "published" | "draft" | "archived";
const PAGE_SIZE = 10;
const FETCH_LIMIT = 60;

export default function PostsView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [status, setStatus] = React.useState<StatusTab>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  const postsQuery = useQuery({
    queryKey: ["admin-posts"],
    queryFn: () => apiFetch<Paginated<PostDTO>>(`/api/posts?status=all&sort=recent&limit=${FETCH_LIMIT}`),
    enabled: allowed,
    staleTime: 15_000,
    retry: 1,
  });

  const posts = React.useMemo(() => {
    const items = postsQuery.data?.items ?? [];
    const term = search.trim().toLowerCase();
    return items.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (term && !p.title.toLowerCase().includes(term) && !p.slug.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [postsQuery.data, status, search]);

  React.useEffect(() => {
    setPage(1);
  }, [status, search]);

  const pageItems = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const statusMutation = useMutation({
    mutationFn: (post: PostDTO) =>
      apiFetch<PostDTO>(`/api/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: post.status === "published" ? "draft" : "published" }),
      }),
    onSuccess: (post) => {
      toast({
        title: post.status === "published" ? "Post published" : "Post unpublished",
        description: post.title,
      });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (post: PostDTO) => apiFetch(`/api/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Post deleted", description: "The post and its view history were removed." });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading posts" />;
  if (!allowed) return <ForbiddenState />;

  return (
    <AdminShell
      title="Posts"
      description="Every article on the blog — drafts, published and archived."
      actions={
        <ALink href="#/admin/posts/new">
          <Button size="sm" className="h-9 gap-2">
            <FilePlus2 className="size-4" aria-hidden="true" />
            New post
          </Button>
        </ALink>
      }
    >
      <SEOHead title="Posts — Admin & Developer | MN.KP" noindex />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or slug..."
            aria-label="Search posts"
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
            <TabsTrigger value="published" className="h-8">Published</TabsTrigger>
            <TabsTrigger value="draft" className="h-8">Drafts</TabsTrigger>
            <TabsTrigger value="archived" className="h-8">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DataState query={postsQuery} empty={posts.length === 0} emptyVariant="posts" skeletonRows={6}>
        {() => (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42%]">Post</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {post.coverImageUrl ? (
                            <img
                              src={post.coverImageUrl}
                              alt={post.title}
                              loading="lazy"
                              decoding="async"
                              className="hidden size-10 shrink-0 rounded-md object-cover sm:block"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="hidden size-10 shrink-0 rounded-md bg-gradient-to-br from-gold/30 to-primary/20 sm:block"
                            />
                          )}
                          <div className="min-w-0">
                            <ALink
                              href={`#/admin/posts/${post.id}`}
                              className="block truncate font-medium hover:text-primary"
                            >
                              {post.title}
                            </ALink>
                            <p className="truncate text-xs text-muted-foreground">/{post.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PostStatusBadge status={post.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {post.category?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCompact(post.viewsCount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(post.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <ALink href={`#/admin/posts/${post.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`Edit ${post.title}`}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                          </ALink>
                          {post.status === "published" ? (
                            <ALink href={`#/blog/${post.slug}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                aria-label={`View ${post.title}`}
                              >
                                <Eye className="size-4" aria-hidden="true" />
                              </Button>
                            </ALink>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate(post)}
                          >
                            {post.status === "published" ? "Unpublish" : "Publish"}
                          </Button>
                          <ConfirmAction
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 text-muted-foreground hover:text-destructive"
                                aria-label={`Delete ${post.title}`}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            }
                            title="Delete this post?"
                            description={`"${post.title}" will be permanently removed with its view history. This cannot be undone.`}
                            onConfirm={() => deleteMutation.mutateAsync(post)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <AdminPager page={page} totalPages={totalPages} total={posts.length} onChange={setPage} />
          </div>
        )}
      </DataState>
    </AdminShell>
  );
}
