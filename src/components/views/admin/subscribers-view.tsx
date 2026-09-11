"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { NewsletterSubscriberDTO, Paginated } from "@/types";
import { AdminShell } from "./_shell";
import {
  AdminPager,
  apiFetch,
  ConfirmAction,
  CopyText,
  fmtDate,
  ToneBadge,
  useAdminGuard,
  useDebounced,
} from "./_shared";

/**
 * Newsletter subscribers admin (#/admin/subscribers — route key
 * "admin-subscribers"). Search + status tabs, inline status PATCH, delete,
 * and Export CSV (blob download of the current filter, up to 60 rows).
 */

type StatusTab = "all" | "pending" | "confirmed" | "unsubscribed";
const PAGE_SIZE = 20;
const EXPORT_LIMIT = 60;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export default function SubscribersView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [status, setStatus] = React.useState<StatusTab>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const q = useDebounced(search);
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [status, q]);

  const buildUrl = (limit: number) =>
    `/api/newsletter/admin?page=1&limit=${limit}` +
    `${status !== "all" ? `&status=${status}` : ""}` +
    `${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  const subsQuery = useQuery({
    queryKey: ["admin-subscribers", status, q, page],
    queryFn: () =>
      apiFetch<Paginated<NewsletterSubscriberDTO>>(
        `/api/newsletter/admin?page=${page}&limit=${PAGE_SIZE}` +
          `${status !== "all" ? `&status=${status}` : ""}` +
          `${q ? `&q=${encodeURIComponent(q)}` : ""}`
      ),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ sub, status: next }: { sub: NewsletterSubscriberDTO; status: string }) =>
      apiFetch<NewsletterSubscriberDTO>(`/api/newsletter/${sub.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      }),
    onSuccess: (updated) => {
      toast({ title: "Subscriber updated", description: `${updated.email} — ${updated.status}` });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (sub: NewsletterSubscriberDTO) =>
      apiFetch(`/api/newsletter/${sub.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Subscriber removed" });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const data = await apiFetch<Paginated<NewsletterSubscriberDTO>>(buildUrl(EXPORT_LIMIT));
      const header = ["Email", "Status", "Source", "Subscribed", "Confirmed", "Unsubscribed"];
      const lines = [header.join(",")];
      for (const sub of data.items) {
        lines.push(
          [
            csvEscape(sub.email),
            sub.status,
            sub.source,
            sub.subscribedAt,
            sub.confirmedAt ?? "",
            sub.unsubscribedAt ?? "",
          ].join(",")
        );
      }
      const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mnkp-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "CSV exported",
        description: `${data.items.length} subscribers (${status !== "all" ? `${status}, ` : ""}${q ? `"${q}", ` : ""}all-time).`,
      });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <LoadingState variant="spinner" label="Loading subscribers" />;
  if (!allowed) return <ForbiddenState />;

  const total = subsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell
      title="Newsletter subscribers"
      description="Everyone who raised a hand for the MN.KP letter."
      actions={
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-2"
          onClick={exportCsv}
          disabled={exporting}
        >
          <Download className="size-4" aria-hidden="true" />
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      }
    >
      <SEOHead title="Subscribers — Admin & Developer | MN.KP" noindex />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email..."
            aria-label="Search subscribers"
            className="h-10 pl-9"
          />
        </div>
        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusTab)} aria-label="Filter by status">
          <TabsList className="h-10 w-full sm:w-auto">
            <TabsTrigger value="all" className="h-8">All</TabsTrigger>
            <TabsTrigger value="pending" className="h-8">Pending</TabsTrigger>
            <TabsTrigger value="confirmed" className="h-8">Confirmed</TabsTrigger>
            <TabsTrigger value="unsubscribed" className="h-8">Unsubscribed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DataState query={subsQuery} emptyVariant="inbox" skeletonRows={6}>
        {(data) => (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Subscribed</TableHead>
                    <TableHead>Confirmed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <CopyText value={sub.email} label="Email" className="font-medium" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ToneBadge
                            tone={
                              sub.status === "confirmed"
                                ? "emerald"
                                : sub.status === "pending"
                                  ? "amber"
                                  : "muted"
                            }
                          >
                            {sub.status}
                          </ToneBadge>
                          <Select
                            value={sub.status}
                            onValueChange={(v) =>
                              updateMutation.mutate({ sub, status: v })
                            }
                            disabled={updateMutation.isPending}
                          >
                            <SelectTrigger
                              className="h-8 w-[110px] text-xs"
                              aria-label={`Status for ${sub.email}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">pending</SelectItem>
                              <SelectItem value="confirmed">confirmed</SelectItem>
                              <SelectItem value="unsubscribed">unsubscribed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-muted-foreground">
                          {sub.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(sub.subscribedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(sub.confirmedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end">
                          <ConfirmAction
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 text-muted-foreground hover:text-destructive"
                                aria-label={`Delete ${sub.email}`}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            }
                            title="Remove this subscriber?"
                            description={`${sub.email} will be permanently deleted from the newsletter list.`}
                            onConfirm={() => deleteMutation.mutateAsync(sub)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <AdminPager page={page} totalPages={totalPages} total={total} onChange={setPage} />
          </div>
        )}
      </DataState>
    </AdminShell>
  );
}
