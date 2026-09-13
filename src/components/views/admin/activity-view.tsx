"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Info, Redo2, Undo2, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import type { AuditAction, AuditLogDTO } from "@/types";
import { cn } from "@/lib/utils";
import { AdminShell } from "./_shell";
import { AdminPager, apiFetch, timeAgo, ToneBadge, useAdminGuard } from "./_shared";

/**
 * Activity & Undo (#/admin/activity — route key "admin-activity").
 * Every staff change logged with one-click Undo (replay the BEFORE snapshot)
 * and Redo (replay the AFTER snapshot). Since an undo may touch ANY entity,
 * a successful undo/redo invalidates the ENTIRE query cache.
 */

const PAGE_SIZE = 30;

interface AuditResponse {
  items: AuditLogDTO[];
  total: number;
  page: number;
  limit: number;
  lastRestorableId: string | null;
}

interface UndoRedoResponse {
  entry: AuditLogDTO;
  restored: unknown;
  message: string;
  by: string;
}

/** Color-coded action chip (violet is the sanctioned import accent). */
function ActionBadge({ action }: { action: AuditAction }) {
  switch (action) {
    case "create":
      return <ToneBadge tone="emerald">create</ToneBadge>;
    case "update":
      return <ToneBadge tone="gold">update</ToneBadge>;
    case "delete":
      return <ToneBadge tone="red">delete</ToneBadge>;
    case "toggle":
      return <ToneBadge tone="amber">toggle</ToneBadge>;
    case "import":
      return (
        <Badge
          variant="outline"
          className="border-violet-500/40 bg-violet-500/10 font-medium text-violet-600 dark:text-violet-400"
        >
          import
        </Badge>
      );
    default:
      return <ToneBadge tone="muted">{action}</ToneBadge>;
  }
}

export default function ActivityView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);

  const auditQuery = useQuery({
    queryKey: ["audit", page],
    queryFn: () => apiFetch<AuditResponse>(`/api/audit?limit=${PAGE_SIZE}&page=${page}`),
    enabled: allowed,
    staleTime: 10_000,
    retry: 1,
  });

  const invalidateEverything = () => {
    // Any entity may have changed (setting / ad / post / product) — the
    // simplest correct approach after an undo/redo is invalidating all.
    void queryClient.invalidateQueries();
  };

  const undoMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<UndoRedoResponse>("/api/audit/undo", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    onSuccess: (data) => {
      toast({ title: "Undone", description: data.message });
      invalidateEverything();
    },
    onError: (e: Error) =>
      toast({ title: "Undo failed", description: e.message, variant: "destructive" }),
  });

  const redoMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<UndoRedoResponse>("/api/audit/redo", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    onSuccess: (data) => {
      toast({ title: "Redone", description: data.message });
      invalidateEverything();
    },
    onError: (e: Error) =>
      toast({ title: "Redo failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading activity" />;
  if (!allowed) return <ForbiddenState />;

  const totalPages = auditQuery.data ? Math.max(1, Math.ceil(auditQuery.data.total / PAGE_SIZE)) : 1;

  return (
    <AdminShell
      title="Activity & Undo"
      description="Every change logged — revert anything with one click."
    >
      <SEOHead title="Activity & Undo — Admin & Developer | MN.KP" noindex />

      <div className="space-y-4">
        {/* explainer */}
        <Card className="border-gold/30 bg-gold/[0.03]">
          <CardContent className="flex items-start gap-3 pt-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold">
              <History className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium">Time-travel for your changes</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                Undo replays the exact stored snapshot — settings values, ads, posts and products
                restore byte-for-byte. Deleted items come back; created items are removed.
                Redo re-applies anything you undone.
              </p>
            </div>
          </CardContent>
        </Card>

        <DataState query={auditQuery} emptyVariant="generic" skeletonRows={6}>
          {(data) => (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Change log</CardTitle>
                  <CardDescription>
                    {data.total} {data.total === 1 ? "entry" : "entries"} · newest first · page {page}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="max-h-[640px] divide-y overflow-y-auto scrollbar-slim">
                    {data.items.map((entry) => {
                      const canUndo = entry.restorable && !entry.undoneAt;
                      const canRedo = entry.restorable && !!entry.undoneAt;
                      const busy =
                        (undoMutation.isPending && undoMutation.variables === entry.id) ||
                        (redoMutation.isPending && redoMutation.variables === entry.id);
                      return (
                        <li
                          key={entry.id}
                          className={cn(
                            "flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-3",
                            entry.undoneAt && "bg-muted/40 opacity-70"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <ActionBadge action={entry.action} />
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">
                                {entry.entity}
                              </Badge>
                              {entry.undoneAt ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
                                >
                                  Undone
                                </Badge>
                              ) : null}
                            </div>
                            <p
                              className={cn(
                                "mt-1 truncate text-sm font-medium",
                                entry.undoneAt && "line-through decoration-muted-foreground/60"
                              )}
                            >
                              {entry.label}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <UserIcon className="size-3" aria-hidden="true" />
                                {entry.userName ?? "system"}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{timeAgo(entry.createdAt)}</span>
                              {entry.undoneAt ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-amber-600 dark:text-amber-400">
                                    Redo to re-apply
                                  </span>
                                </>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                            {canUndo ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 gap-1.5"
                                disabled={busy}
                                onClick={() => undoMutation.mutate(entry.id)}
                                aria-label={`Undo ${entry.label}`}
                              >
                                <Undo2 className="size-3.5" aria-hidden="true" />
                                Undo
                              </Button>
                            ) : null}
                            {canRedo ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 gap-1.5 border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
                                disabled={busy}
                                onClick={() => redoMutation.mutate(entry.id)}
                                aria-label={`Redo ${entry.label}`}
                              >
                                <Redo2 className="size-3.5" aria-hidden="true" />
                                Redo
                              </Button>
                            ) : null}
                            {!entry.restorable && !entry.undoneAt ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Info className="size-3" aria-hidden="true" />
                                snapshot not restorable
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
              <AdminPager
                page={page}
                totalPages={totalPages}
                total={data.total}
                onChange={setPage}
              />
            </div>
          )}
        </DataState>
      </div>
    </AdminShell>
  );
}
