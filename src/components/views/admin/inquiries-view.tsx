"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ChevronDown, Mail, MessageCircle, Phone, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import type { InquiryDTO, Paginated } from "@/types";
import { cn } from "@/lib/utils";
import { AdminShell } from "./_shell";
import {
  AdminPager,
  apiFetch,
  ConfirmAction,
  CopyText,
  InquiryStatusBadge,
  PriorityBadge,
  timeAgo,
  useAdminGuard,
  useDebounced,
} from "./_shared";

/**
 * Inquiries inbox (#/admin/inquiries — route key "admin-inquiries").
 * THE user-facing centerpiece: every form submission, fully visible with
 * contact details — expandable cards, gold contact block (email copy +
 * mailto, phone copy + tel, WhatsApp deep link w/ prefilled greeting),
 * inline status/priority, internal notes, mark-replied, delete.
 */

type StatusTab = "" | "new" | "in_progress" | "replied" | "closed" | "spam";
const PAGE_SIZE = 10;
const TYPE_OPTIONS = [
  "",
  "general",
  "sponsorship",
  "partnership",
  "advertising",
  "support",
  "feedback",
  "venture",
  "collab",
] as const;

interface InquiryCounts {
  all: number;
  new: number;
  in_progress: number;
  replied: number;
  closed: number;
  spam: number;
}

async function fetchCounts(): Promise<InquiryCounts> {
  const statuses: StatusTab[] = ["", "new", "in_progress", "replied", "closed", "spam"];
  const results = await Promise.all(
    statuses.map((s) =>
      apiFetch<Paginated<InquiryDTO>>(`/api/inquiries?limit=1${s ? `&status=${s}` : ""}`)
        .then((r) => r.total)
        .catch(() => 0)
    )
  );
  const [all, newCount, inProgress, replied, closed, spam] = results;
  return { all, new: newCount, in_progress: inProgress, replied, closed, spam };
}

function waLink(inquiry: InquiryDTO): string | null {
  const digits = (inquiry.phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const firstName = inquiry.name.trim().split(/\s+/)[0] ?? inquiry.name;
  const text = `Hi ${firstName}, this is Nihad from MN.KP — thanks for your message about "${inquiry.subject ?? "your inquiry"}".`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function InquiriesView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [status, setStatus] = React.useState<StatusTab>("");
  const [type, setType] = React.useState<string>("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const q = useDebounced(search);

  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setPage(1);
  }, [status, type, q]);

  const countsQuery = useQuery({
    queryKey: ["admin-inquiry-counts"],
    queryFn: fetchCounts,
    enabled: allowed,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const listQuery = useQuery({
    queryKey: ["admin-inquiries", status, type, q, page],
    queryFn: () =>
      apiFetch<Paginated<InquiryDTO>>(
        `/api/inquiries?page=${page}&limit=${PAGE_SIZE}` +
          `${status ? `&status=${status}` : ""}` +
          `${type ? `&type=${type}` : ""}` +
          `${q ? `&q=${encodeURIComponent(q)}` : ""}`
      ),
    enabled: allowed,
    staleTime: 15_000,
    retry: 1,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-inquiry-counts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ inquiry, body }: { inquiry: InquiryDTO; body: Record<string, unknown> }) =>
      apiFetch<InquiryDTO>(`/api/inquiries/${inquiry.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (updated) => {
      toast({ title: "Inquiry updated", description: `${updated.name} — ${updated.status.replace("_", " ")}` });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (inquiry: InquiryDTO) => apiFetch(`/api/inquiries/${inquiry.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Inquiry deleted" });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading inbox" />;
  if (!allowed) return <ForbiddenState />;

  const counts = countsQuery.data;
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AdminShell
      title="Inquiries"
      description="Every form submission with full contact details — nothing slips through."
    >
      <SEOHead title="Inquiries — Admin & Developer | MN.KP" noindex />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <Tabs
          value={status || "all"}
          onValueChange={(v) => setStatus(v === "all" ? "" : (v as StatusTab))}
          aria-label="Filter by status"
          className="w-full xl:w-auto"
        >
          <TabsList className="h-10 w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="all" className="h-8">
              All{counts ? ` (${counts.all})` : ""}
            </TabsTrigger>
            <TabsTrigger value="new" className="h-8">
              New{counts ? ` (${counts.new})` : ""}
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="h-8">
              In progress{counts ? ` (${counts.in_progress})` : ""}
            </TabsTrigger>
            <TabsTrigger value="replied" className="h-8">
              Replied{counts ? ` (${counts.replied})` : ""}
            </TabsTrigger>
            <TabsTrigger value="closed" className="h-8">
              Closed{counts ? ` (${counts.closed})` : ""}
            </TabsTrigger>
            <TabsTrigger value="spam" className="h-8">
              Spam{counts ? ` (${counts.spam})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or subject..."
              aria-label="Search inquiries"
              className="h-10 pl-9"
            />
          </div>
          <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
            <SelectTrigger className="h-10 w-full sm:w-[170px]" aria-label="Filter by type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPE_OPTIONS.filter(Boolean).map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataState query={listQuery} emptyVariant="inbox" skeletonRows={5}>
        {(data) => (
          <div className="space-y-4">
            {data.items.length > 1 ? (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted-foreground">
                  {data.items.length} shown of {total}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setCollapsed((prev) =>
                      prev.size === 0 ? new Set(data.items.map((i) => i.id)) : new Set()
                    )
                  }
                >
                  {collapsed.size === 0 ? "Collapse all" : "Expand all"}
                </Button>
              </div>
            ) : null}

            {data.items.map((inquiry) => {
              const isCollapsed = collapsed.has(inquiry.id);
              const noteDraft = notes[inquiry.id] ?? inquiry.internalNote ?? "";
              const whatsapp = waLink(inquiry);
              return (
                <Card
                  key={inquiry.id}
                  className={cn(
                    "overflow-hidden transition-shadow hover:shadow-md",
                    inquiry.status === "new" && "border-gold/50"
                  )}
                >
                  <CardContent className="p-0">
                    {/* header row — always visible */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                      <button
                        type="button"
                        onClick={() => toggle(inquiry.id)}
                        aria-expanded={!isCollapsed}
                        aria-label={`${isCollapsed ? "Expand" : "Collapse"} inquiry from ${inquiry.name}`}
                        className="flex min-h-11 flex-1 items-center gap-3 text-left"
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            isCollapsed && "-rotate-90"
                          )}
                          aria-hidden="true"
                        />
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{inquiry.name}</span>
                          {inquiry.status === "new" ? (
                            <span className="relative flex size-2" aria-label="New">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                              <span className="relative inline-flex size-2 rounded-full bg-gold" />
                            </span>
                          ) : null}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            inquiry.type === "venture" || inquiry.type === "collab"
                              ? "border-gold/40 bg-gold/10 text-gold"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {inquiry.type}
                        </Badge>
                        {inquiry.subject ? (
                          <span className="hidden max-w-[280px] truncate text-sm text-muted-foreground lg:inline">
                            {inquiry.subject}
                          </span>
                        ) : null}
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={inquiry.status}
                          onValueChange={(v) =>
                            updateMutation.mutate({ inquiry, body: { status: v } })
                          }
                        >
                          <SelectTrigger
                            className="h-9 w-[130px] text-xs"
                            aria-label={`Status for ${inquiry.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">new</SelectItem>
                            <SelectItem value="in_progress">in progress</SelectItem>
                            <SelectItem value="replied">replied</SelectItem>
                            <SelectItem value="closed">closed</SelectItem>
                            <SelectItem value="spam">spam</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={inquiry.priority}
                          onValueChange={(v) =>
                            updateMutation.mutate({ inquiry, body: { priority: v } })
                          }
                        >
                          <SelectTrigger
                            className="h-9 w-[110px] text-xs"
                            aria-label={`Priority for ${inquiry.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">low</SelectItem>
                            <SelectItem value="normal">normal</SelectItem>
                            <SelectItem value="high">high</SelectItem>
                            <SelectItem value="urgent">urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(inquiry.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* expanded body */}
                    {!isCollapsed ? (
                      <div className="border-t bg-muted/20 p-4">
                        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                          <div className="space-y-4">
                            {inquiry.subject ? (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                  Subject
                                </p>
                                <p className="mt-1 text-sm font-medium">{inquiry.subject}</p>
                              </div>
                            ) : null}
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Message
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                                {inquiry.message}
                              </p>
                            </div>

                            {/* internal note */}
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Internal note (private)
                              </p>
                              <Textarea
                                value={noteDraft}
                                onChange={(e) =>
                                  setNotes({ ...notes, [inquiry.id]: e.target.value })
                                }
                                rows={2}
                                placeholder="Context, follow-ups, deal size..."
                                aria-label={`Internal note for ${inquiry.name}`}
                                className="mt-1 bg-background"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 h-8"
                                disabled={
                                  updateMutation.isPending || noteDraft === (inquiry.internalNote ?? "")
                                }
                                onClick={() =>
                                  updateMutation.mutate({
                                    inquiry,
                                    body: { internalNote: noteDraft },
                                  })
                                }
                              >
                                Save note
                              </Button>
                            </div>
                          </div>

                          {/* contact block */}
                          <div className="space-y-3 rounded-xl border border-gold/40 bg-gold/[0.04] p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                              Contact
                            </p>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <CopyText value={inquiry.email} label="Email" className="flex-1" />
                                <a
                                  href={`mailto:${inquiry.email}?subject=${encodeURIComponent(
                                    `Re: ${inquiry.subject ?? "your inquiry to MN.KP"}`
                                  )}`}
                                  className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                                  aria-label={`Email ${inquiry.name}`}
                                >
                                  Mail
                                </a>
                              </div>
                              {inquiry.phone ? (
                                <div className="flex items-center gap-2">
                                  <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                  <CopyText value={inquiry.phone} label="Phone" className="flex-1" />
                                  <a
                                    href={`tel:${inquiry.phone.replace(/\s+/g, "")}`}
                                    className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                                    aria-label={`Call ${inquiry.name}`}
                                  >
                                    Call
                                  </a>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No phone provided.</p>
                              )}
                              {whatsapp ? (
                                <a
                                  href={whatsapp}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                                  aria-label={`WhatsApp ${inquiry.name}`}
                                >
                                  <MessageCircle className="size-4" aria-hidden="true" />
                                  WhatsApp {inquiry.name.split(" ")[0]}
                                </a>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 border-t border-gold/20 pt-3">
                              <InquiryStatusBadge status={inquiry.status} />
                              <PriorityBadge priority={inquiry.priority} />
                              {inquiry.repliedAt ? (
                                <Badge variant="outline" className="border-primary/30 text-primary">
                                  <CheckCheck className="mr-1 size-3" aria-hidden="true" />
                                  replied {timeAgo(inquiry.repliedAt)}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {inquiry.status !== "replied" ? (
                                <Button
                                  size="sm"
                                  className="h-9"
                                  disabled={updateMutation.isPending}
                                  onClick={() =>
                                    updateMutation.mutate({
                                      inquiry,
                                      body: { status: "replied", replied: true },
                                    })
                                  }
                                >
                                  Mark replied
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9"
                                  disabled={updateMutation.isPending}
                                  onClick={() =>
                                    updateMutation.mutate({
                                      inquiry,
                                      body: { status: "in_progress", replied: false },
                                    })
                                  }
                                >
                                  Reopen
                                </Button>
                              )}
                              <ConfirmAction
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-9 text-muted-foreground hover:text-destructive"
                                    aria-label={`Delete inquiry from ${inquiry.name}`}
                                  >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                  </Button>
                                }
                                title="Delete this inquiry?"
                                description={`The submission from ${inquiry.name} (${inquiry.email}) will be permanently removed.`}
                                onConfirm={() => deleteMutation.mutateAsync(inquiry)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}

            <AdminPager page={page} totalPages={totalPages} total={total} onChange={setPage} />
          </div>
        )}
      </DataState>
    </AdminShell>
  );
}
