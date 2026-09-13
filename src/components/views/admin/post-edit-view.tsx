"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  FileText,
  Maximize,
  Minimize,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ALink } from "@/components/router/link";
import { ForbiddenState, LoadingState } from "@/components/states";
import { MarkdownBlock, MarkdownFallback } from "@/components/views/shared/markdown";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import { useHashParams } from "@/hooks/use-hash-params";
import { navigate } from "@/hooks/use-router";
import { SITE } from "@/lib/constants";
import type { PostDTO } from "@/types";
import { AdminShell } from "./_shell";
import {
  apiFetch,
  ConfirmAction,
  fmtDate,
  formatCompact,
  PostStatusBadge,
  slugify,
  useAdminGuard,
  useCategories,
} from "./_shared";
import {
  AiAssistCard,
  type AiAssistAction,
  type AiAssistConfirm,
} from "./ai-assist-card";
import { MarkdownToolbar } from "./markdown-toolbar";
import { DraftRecoveryBanner, useDraftAutosave } from "./editor-drafts";
import { SingleImageField } from "@/components/shared/image-uploader";

/**
 * Post editor (#/admin/posts/:id — route key "admin-post-edit"; "new"=create).
 * The full "perfect blog form": 2-col layout (form + sticky preview),
 * auto-slug, counters, Write/Preview tabs, tag chips, quick-pick covers,
 * collapsible SEO card w/ SERP preview, per-field zod errors.
 *
 * Task 12-b power-features: a real AI assist card (backend LLM route
 * /api/ai/assist), a markdown toolbar with selection-aware inserts,
 * local autosave + crash-recovery banner, Ctrl/Cmd+S save, beforeunload
 * guard, a distraction-free zen mode, and an 800-word goal chip.
 */

const BLOG_COVERS = [
  "/images/blog/blog-ai-workflow.webp",
  "/images/blog/blog-ai-tools.webp",
  "/images/blog/blog-career-journey.webp",
  "/images/blog/blog-freelance-calicut.webp",
  "/images/blog/blog-kp-foundation.webp",
  "/images/blog/blog-photo-ai-editing.webp",
];

const postFormSchema = z.object({
  title: z.string().min(4, "Title must be at least 4 characters").max(140, "Keep the title under 140 characters"),
  slug: z.string().max(96).optional(),
  excerpt: z.string().max(300, "Excerpts max out at 300 characters").optional(),
  content: z.string().min(1, "Content is required"),
  coverImageUrl: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]),
  isFeatured: z.boolean(),
  categoryId: z.string().optional(),
  publishedAt: z.string().optional(),
  seoTitle: z.string().max(70, "SEO titles max out at 70 characters").optional(),
  seoDescription: z.string().max(180, "SEO descriptions max out at 180 characters").optional(),
  ogImageUrl: z.string().optional(),
  canonicalUrl: z.string().optional(),
});

type PostFormValues = z.infer<typeof postFormSchema>;

/** Snapshot payload for the local crash-recovery autosave. */
interface PostDraftData {
  values: PostFormValues;
  tags: string[];
}

function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function wordsPerMinute(content: string): number {
  return Math.max(1, Math.ceil(countWords(content) / 200));
}

const WORD_GOAL = 800;

export default function PostEditView() {
  const { id } = useHashParams<{ id: string }>();
  const isNew = !id || id === "new";
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();
  const categories = useCategories("blog");

  const [tags, setTags] = React.useState<string[]>([]);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [tagInput, setTagInput] = React.useState("");
  const [contentTab, setContentTab] = React.useState<"write" | "preview">("write");
  const [seoOpen, setSeoOpen] = React.useState(false);
  const [extraDirty, setExtraDirty] = React.useState(false);
  const [zen, setZen] = React.useState(false);
  const [modKey, setModKey] = React.useState("Ctrl");

  const contentRef = React.useRef<HTMLTextAreaElement | null>(null);
  const zenRef = React.useRef<HTMLTextAreaElement | null>(null);
  const submitRef = React.useRef<() => void>(() => undefined);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      coverImageUrl: "",
      status: "draft",
      isFeatured: false,
      categoryId: "",
      publishedAt: "",
      seoTitle: "",
      seoDescription: "",
      ogImageUrl: "",
      canonicalUrl: "",
    },
  });

  const postQuery = useQuery({
    queryKey: ["admin-post", id],
    queryFn: () => apiFetch<PostDTO>(`/api/posts/${id}`),
    enabled: allowed && !isNew,
    retry: 1,
  });

  React.useEffect(() => {
    if (!postQuery.data) return;
    const p = postQuery.data;
    form.reset({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? "",
      content: p.content,
      coverImageUrl: p.coverImageUrl ?? "",
      status: p.status,
      isFeatured: p.isFeatured,
      categoryId: p.category?.id ?? "",
      publishedAt: p.publishedAt ? p.publishedAt.slice(0, 10) : "",
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      ogImageUrl: p.ogImageUrl ?? "",
      canonicalUrl: p.canonicalUrl ?? "",
    });
    setTags(p.tags);
    setSlugTouched(true);
    setExtraDirty(false);
  }, [postQuery.data, form]);

  // useWatch (single call, whole values) instead of form.watch — satisfies
  // react-hooks/incompatible-library; defaults are complete so the cast is safe.
  const watched = useWatch({ control: form.control }) as PostFormValues;

  const effectiveSlug = slugTouched && watched.slug ? slugify(watched.slug) : slugify(watched.title);
  const wordCount = countWords(watched.content ?? "");
  const readingMinutes = wordsPerMinute(watched.content ?? "");
  const isDirty = form.formState.isDirty || extraDirty;

  /* ---------------- local autosave + crash recovery ---------------- */

  const draftKey = `mnkp_draft_post_${isNew ? "new" : id}`;

  const draft = useDraftAutosave<PostDraftData>({
    key: draftKey,
    ready: isNew || !!postQuery.data,
    isDirty,
    tick: JSON.stringify([watched, tags]),
    capture: () => ({ values: form.getValues(), tags }),
    differs: (snap) => {
      const data = snap.data;
      if (!data || typeof data !== "object" || typeof data.values !== "object" || !data.values) {
        return false; // unrecognized snapshot shape
      }
      if (isNew) {
        return !!(data.values.title?.trim() || data.values.content?.trim() || (data.tags?.length ?? 0) > 0);
      }
      const p = postQuery.data;
      if (!p) return false;
      // only offer recovery when the local copy is newer than the server copy
      const serverTime = new Date(p.updatedAt).getTime();
      if (Number.isFinite(serverTime) && snap.savedAt <= serverTime) return false;
      return (
        data.values.title !== p.title ||
        data.values.content !== p.content ||
        (data.values.excerpt ?? "") !== (p.excerpt ?? "") ||
        data.values.status !== p.status ||
        JSON.stringify(data.tags ?? []) !== JSON.stringify(p.tags)
      );
    },
    onRestore: (data) => {
      const v = data.values;
      form.reset({
        title: v?.title ?? "",
        slug: v?.slug ?? "",
        excerpt: v?.excerpt ?? "",
        content: v?.content ?? "",
        coverImageUrl: v?.coverImageUrl ?? "",
        status: v?.status ?? "draft",
        isFeatured: !!v?.isFeatured,
        categoryId: v?.categoryId ?? "",
        publishedAt: v?.publishedAt ?? "",
        seoTitle: v?.seoTitle ?? "",
        seoDescription: v?.seoDescription ?? "",
        ogImageUrl: v?.ogImageUrl ?? "",
        canonicalUrl: v?.canonicalUrl ?? "",
      });
      setTags(Array.isArray(data.tags) ? data.tags : []);
      setSlugTouched(true);
      setExtraDirty(true);
      toast({ title: "Local draft restored", description: "Review it and save when you are ready." });
    },
  });

  /* ---------------- server mutations ---------------- */

  const saveMutation = useMutation({
    mutationFn: (values: PostFormValues) => {
      const body: Record<string, unknown> = {
        title: values.title,
        content: values.content,
        status: values.status,
        isFeatured: values.isFeatured,
        tags,
        categoryId: values.categoryId || null,
        coverImageUrl: values.coverImageUrl || "",
        excerpt: values.excerpt || undefined,
        publishedAt: values.publishedAt ? `${values.publishedAt}T12:00:00` : undefined,
        seoTitle: values.seoTitle || undefined,
        seoDescription: values.seoDescription || undefined,
        ogImageUrl: values.ogImageUrl || "",
        canonicalUrl: values.canonicalUrl || "",
      };
      if (slugTouched && values.slug) body.slug = slugify(values.slug);
      return isNew
        ? apiFetch<PostDTO>("/api/posts", { method: "POST", body: JSON.stringify(body) })
        : apiFetch<PostDTO>(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (post) => {
      toast({
        title: isNew ? "Post created" : "Post saved",
        description: post.title,
      });
      setExtraDirty(false);
      draft.clear();
      void queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      if (isNew) navigate(`/admin/posts/${post.id}`);
      else form.reset(form.getValues());
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Post deleted" });
      draft.clear();
      void queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      navigate("/admin/posts");
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const onSubmit = (values: PostFormValues) => saveMutation.mutate(values);

  /* ---------------- keyboard + unload guards ---------------- */

  // keep the submit callable fresh without re-binding window listeners
  React.useEffect(() => {
    submitRef.current = form.handleSubmit(onSubmit);
  });

  // Ctrl/Cmd+S anywhere in the editor saves the post
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Esc exits zen mode
  React.useEffect(() => {
    if (!zen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zen]);

  // desktop-style unsaved-changes guard (mobile browsers ignore this)
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // platform-aware modifier hint (Cmd on Apple platforms, Ctrl elsewhere)
  React.useEffect(() => {
    if (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) setModKey("\u2318");
  }, []);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    if (!tag || tags.includes(tag) || tags.length >= 10) return;
    setTags([...tags, tag]);
    setTagInput("");
    setExtraDirty(true);
  };

  if (isLoading) return <LoadingState variant="spinner" label="Loading editor" />;
  if (!allowed) return <ForbiddenState />;
  if (!isNew && postQuery.isPending) return <LoadingState variant="skeleton" rows={6} />;
  if (!isNew && postQuery.isError) {
    return (
      <AdminShell title="Edit post">
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          This post could not be loaded. {postQuery.error instanceof Error ? postQuery.error.message : ""}
        </p>
      </AdminShell>
    );
  }

  const serpTitle = (watched.seoTitle || watched.title || "Untitled post").slice(0, 60);
  const serpDesc = (watched.seoDescription || watched.excerpt || "Add an excerpt or SEO description...").slice(0, 155);

  /* ---------------- AI assist wiring ---------------- */

  const buildAiRequest = (action: AiAssistAction): Record<string, unknown> => {
    const title = (form.getValues("title") ?? "").trim();
    const content = (form.getValues("content") ?? "").trim();
    switch (action) {
      case "title":
        if (!title && !content) throw new Error("Add a title or some content first.");
        return { action, title: title || undefined, content: content || undefined };
      case "excerpt":
      case "tags":
      case "proofread":
        if (!title || !content) throw new Error("Add a title and some content first.");
        return { action, title, content };
      case "outline": {
        const firstLine = content
          .split("\n")
          .map((line) => line.replace(/^#+\s*/, "").trim())
          .find(Boolean);
        const topic = title || firstLine;
        if (!topic) throw new Error("Add a title or a first line so the AI knows the topic.");
        return { action, topic: topic.slice(0, 300), title: title || undefined, content: content || undefined };
      }
      case "continue": {
        if (!content) throw new Error("Write a few lines first — the AI continues from your draft.");
        const fallbackTopic = content
          .split("\n")
          .map((line) => line.trim())
          .find(Boolean);
        return { action, title: title || undefined, topic: title || fallbackTopic, content };
      }
      case "description":
        throw new Error("This action is not available for posts.");
    }
  };

  const insertIntoContent = (insert: string, mode: "cursor" | "append") => {
    const current = form.getValues("content") ?? "";
    if (!current.trim()) {
      form.setValue("content", insert, { shouldDirty: true });
      return;
    }
    if (mode === "append") {
      form.setValue("content", `${current.replace(/\s+$/, "")}\n\n${insert}`, { shouldDirty: true });
      return;
    }
    const el = (zen ? zenRef : contentRef).current;
    const pos = el?.selectionStart ?? current.length;
    const before = current.slice(0, pos);
    const needsBreak = before.trim() !== "" && !before.endsWith("\n");
    form.setValue("content", before + (needsBreak ? "\n\n" : "") + insert + current.slice(pos), {
      shouldDirty: true,
    });
  };

  const applyAiResult = (action: AiAssistAction, text: string) => {
    switch (action) {
      case "title":
        form.setValue("title", text.slice(0, 140), { shouldDirty: true });
        toast({
          title: "Title updated",
          description: text.length > 90 ? `${text.slice(0, 90)}...` : text,
        });
        break;
      case "excerpt":
        form.setValue("excerpt", text.replace(/\s+/g, " ").trim().slice(0, 300), { shouldDirty: true });
        toast({ title: "Excerpt replaced" });
        break;
      case "tags": {
        const incoming = text
          .split(/[,\n]/)
          .map((t) =>
            t
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
          )
          .filter(Boolean)
          .slice(0, 8);
        const merged = [...new Set([...tags, ...incoming])].slice(0, 10);
        setTags(merged);
        setExtraDirty(true);
        toast({
          title: "Tags merged",
          description: `${merged.length} tag${merged.length === 1 ? "" : "s"} on this post.`,
        });
        break;
      }
      case "outline":
        insertIntoContent(text, "cursor");
        toast({ title: "Outline inserted", description: "Splice it into the draft as needed." });
        break;
      case "continue":
        insertIntoContent(text, "append");
        toast({ title: "Draft extended", description: "The continuation was appended to the content." });
        break;
      case "proofread":
        form.setValue("content", text, { shouldDirty: true });
        toast({ title: "Content proofread", description: "Review the corrections before saving." });
        break;
      case "description":
        break;
    }
  };

  const aiConfirmFor = (action: AiAssistAction): AiAssistConfirm | null => {
    if (action !== "proofread") return null;
    return {
      title: "Replace the content with the proofread version?",
      description:
        "The editor content will be replaced by the AI-corrected markdown. The previous version stays recoverable from your local draft or the server copy until you save.",
    };
  };

  const setContentValue = (value: string) => form.setValue("content", value, { shouldDirty: true });

  const contentPlaceholder =
    "## A question-style heading works great for AI answers\n\nWrite the article in markdown...";

  return (
    <AdminShell
      title={isNew ? "New post" : "Edit post"}
      description={isNew ? "Draft a fresh article for the MN.KP blog." : `Last updated ${fmtDate(postQuery.data?.updatedAt)}`}
      actions={
        <>
          {isDirty ? (
            <Badge variant="outline" className="h-9 border-amber-500/40 bg-amber-500/10 px-3 text-amber-600 dark:text-amber-400">
              Unsaved changes
            </Badge>
          ) : null}
          <ALink href="#/admin/posts">
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <ArrowLeft className="size-4" aria-hidden="true" />
              All posts
            </Button>
          </ALink>
          <Button
            size="sm"
            className="h-9"
            onClick={form.handleSubmit(onSubmit)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : isNew ? "Create post" : "Save changes"}
          </Button>
          {!isNew ? (
            <ConfirmAction
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-destructive"
                  aria-label="Delete post"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              }
              title="Delete this post?"
              description="The post and its view history will be permanently removed."
              onConfirm={() => deleteMutation.mutateAsync()}
            />
          ) : null}
        </>
      }
    >
      <SEOHead title={`${isNew ? "New post" : "Edit post"} — Admin & Developer | MN.KP`} noindex />

      {draft.snapshot ? (
        <DraftRecoveryBanner
          savedAt={draft.snapshot.savedAt}
          onRestore={draft.restore}
          onDiscard={draft.discard}
        />
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* ---------------- main form column ---------------- */}
          <div className="min-w-0 space-y-6">
            <Card>
              <CardContent className="space-y-5 pt-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="An honest headline that earns the click" {...field} className="h-10 text-base" />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length ?? 0}/140 characters · becomes the H1 and SERP fallback
                      </FormDescription>
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
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">/blog/</span>
                          <Input
                            {...field}
                            value={slugTouched ? field.value : effectiveSlug}
                            onChange={(e) => {
                              setSlugTouched(true);
                              field.onChange(e);
                            }}
                            placeholder="auto-generated-from-title"
                            className="h-10 font-mono text-sm"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        {slugTouched ? "Custom slug — dashes and lowercase" : "Auto-generated from the title (editable)"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="excerpt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Excerpt</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          rows={2}
                          placeholder="One or two sentences for cards and search results"
                        />
                      </FormControl>
                      <FormDescription>{(field.value ?? "").length}/300 characters</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel>Content (markdown)</FormLabel>
                  <Tabs
                    value={contentTab}
                    onValueChange={(v) => setContentTab(v as "write" | "preview")}
                    className="mt-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TabsList className="h-9">
                          <TabsTrigger value="write" className="h-7">Write</TabsTrigger>
                          <TabsTrigger value="preview" className="h-7">
                            <Eye className="mr-1 size-3.5" aria-hidden="true" />
                            Preview
                          </TabsTrigger>
                        </TabsList>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="press-sm size-9"
                          aria-label={zen ? "Exit zen mode" : "Enter zen mode"}
                          title={zen ? "Exit zen mode (Esc)" : "Zen mode — distraction-free writing"}
                          onClick={() => setZen((v) => !v)}
                        >
                          {zen ? (
                            <Minimize className="size-4" aria-hidden="true" />
                          ) : (
                            <Maximize className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {wordCount >= WORD_GOAL ? (
                          <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
                            solid length
                          </Badge>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          ~{readingMinutes} min read · {wordCount.toLocaleString("en-IN")} words ·{" "}
                          {(watched.content ?? "").length.toLocaleString("en-IN")} chars
                        </p>
                        <span className="hidden text-[10px] text-muted-foreground/80 sm:inline">
                          {modKey}+S saves
                        </span>
                      </div>
                    </div>
                  </Tabs>
                  {contentTab === "write" ? (
                    <>
                      <MarkdownToolbar
                        textareaRef={contentRef}
                        onChange={setContentValue}
                        className="mt-3"
                      />
                      <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem className="mt-3">
                            <FormControl>
                              <Textarea
                                {...field}
                                ref={contentRef}
                                rows={18}
                                placeholder={contentPlaceholder}
                                className="min-h-[420px] font-mono text-[13px] leading-relaxed"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : (
                    <div className="mt-3 min-h-[420px] rounded-lg border p-4">
                      {(watched.content ?? "").trim() ? (
                        <React.Suspense fallback={<MarkdownFallback />}>
                          <MarkdownBlock content={watched.content} />
                        </React.Suspense>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                      )}
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="coverImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover image</FormLabel>
                      <FormControl>
                        <SingleImageField
                          value={field.value ?? ""}
                          onChange={(url) => {
                            field.onChange(url);
                            setExtraDirty(true);
                          }}
                          label="Cover image"
                          aspect="aspect-[16/9]"
                        />
                      </FormControl>
                      <FormDescription>Library quick picks:</FormDescription>
                      <div className="flex flex-wrap gap-2">
                        {BLOG_COVERS.map((src) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() => {
                              field.onChange(src);
                              setExtraDirty(true);
                            }}
                            aria-label={`Use cover ${src}`}
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

                <div>
                  <FormLabel>Tags</FormLabel>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Type a tag, press Enter (max 10)"
                      aria-label="Add tag"
                      className="h-10"
                    />
                    <Button type="button" variant="outline" className="h-10" onClick={addTag}>
                      Add
                    </Button>
                  </div>
                  {tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1 pr-1.5">
                          {tag}
                          <button
                            type="button"
                            onClick={() => {
                              setTags(tags.filter((t) => t !== tag));
                              setExtraDirty(true);
                            }}
                            aria-label={`Remove tag ${tag}`}
                            className="flex size-5 items-center justify-center rounded-full hover:bg-muted"
                          >
                            <X className="size-3" aria-hidden="true" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No tags yet — tags power related posts and filters.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ---------------- SEO card ---------------- */}
            <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
              <Card className="border-gold/40">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      aria-expanded={seoOpen}
                    >
                      <div>
                        <CardTitle className="text-base text-gold">SEO &amp; sharing</CardTitle>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Search title, description, OG image and canonical URL
                        </p>
                      </div>
                      <ChevronDown
                        className={`size-5 text-gold transition-transform ${seoOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-5 pt-2">
                    <FormField
                      control={form.control}
                      name="seoTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SEO title</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder="Falls back to the post title" className="h-10" />
                          </FormControl>
                          <FormDescription>{(field.value ?? "").length}/60 recommended</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="seoDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SEO description</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value ?? ""}
                              rows={3}
                              placeholder="Falls back to the excerpt"
                            />
                          </FormControl>
                          <FormDescription>{(field.value ?? "").length}/155 recommended</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ogImageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OG / social image URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder="https://... (optional)" className="h-10" />
                          </FormControl>
                          <FormDescription>
                            Advanced — leave empty to fall back to the cover image
                            on social cards. Accepts https:// URLs and site-relative
                            /api/media/... paths.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {watched.ogImageUrl || watched.coverImageUrl ? (
                      <div className="overflow-hidden rounded-lg border">
                        <img
                          src={watched.ogImageUrl || watched.coverImageUrl || ""}
                          alt="OG image preview"
                          loading="lazy"
                          decoding="async"
                          className="aspect-[1.91/1] w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <FormField
                      control={form.control}
                      name="canonicalUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Canonical URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder="https://... (leave empty unless syndicated)" className="h-10" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* SERP preview */}
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Search result preview
                      </p>
                      <div className="rounded-lg border bg-muted/40 p-4">
                        <p className="truncate text-xs text-primary/70">
                          {SITE.url.replace(/^https?:\/\//, "")}/blog/{effectiveSlug || "slug"}
                        </p>
                        <p className="mt-0.5 truncate text-base font-medium text-primary">{serpTitle}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{serpDesc}</p>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* ---------------- sticky side column ---------------- */}
          <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
            <AiAssistCard
              subline="One-click drafting on the built-in LLM"
              actions={[
                { action: "title", label: "Title ideas" },
                { action: "excerpt", label: "Excerpt" },
                { action: "tags", label: "Tags" },
                { action: "outline", label: "Outline" },
                { action: "continue", label: "Continue draft" },
                { action: "proofread", label: "Proofread" },
              ]}
              buildRequest={buildAiRequest}
              applyResult={applyAiResult}
              confirmFor={aiConfirmFor}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Publishing</CardTitle>
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
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
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
                      <FormDescription>
                        {(categories.data ?? []).find((c) => c.id === field.value)?.slug ?? "no category"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publishedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Publish date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} className="h-10" />
                      </FormControl>
                      <FormDescription>Stamps publishedAt when the post goes live</FormDescription>
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
                        <p className="text-xs text-muted-foreground">Pins the post to home + ad slots</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Reading time
                  </p>
                  <p className="mt-1 text-sm">
                    {readingMinutes} min <span className="text-muted-foreground">(auto — words / 200)</span>
                  </p>
                </div>

                {postQuery.data ? (
                  <div className="space-y-1 rounded-lg border p-3 text-xs text-muted-foreground">
                    <p>Views: <span className="font-medium text-foreground">{formatCompact(postQuery.data.viewsCount)}</span></p>
                    <p>Created: {fmtDate(postQuery.data.createdAt)}</p>
                    <p>Author: {postQuery.data.author?.fullName ?? "—"}</p>
                  </div>
                ) : null}

                <Button type="submit" className="h-10 w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : isNew ? "Create post" : "Save changes"}
                </Button>
              </CardContent>
            </Card>

            {/* Live preview card */}
            <Card className="overflow-hidden">
              <p className="px-4 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                Live preview
              </p>
              <div className="p-4">
                {watched.coverImageUrl ? (
                  <img
                    src={watched.coverImageUrl}
                    alt="Cover preview"
                    loading="lazy"
                    decoding="async"
                    className="mb-3 aspect-video w-full rounded-lg border object-cover"
                  />
                ) : (
                  <div className="mb-3 flex aspect-video w-full items-center justify-center rounded-lg border bg-gradient-to-br from-gold/30 via-gold/10 to-primary/25">
                    <FileText className="size-8 text-foreground/50" aria-hidden="true" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <PostStatusBadge status={watched.status} />
                  {watched.isFeatured ? <Badge variant="outline" className="border-gold/40 text-gold">Featured</Badge> : null}
                  <span className="text-xs text-muted-foreground">{readingMinutes} min read</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight">
                  {watched.title || "Untitled post"}
                </h2>
                {watched.excerpt ? (
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{watched.excerpt}</p>
                ) : null}
                {tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </form>

        {/* ---------------- zen mode overlay ---------------- */}
        {zen ? (
          <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background p-4 sm:p-6" role="dialog" aria-label="Zen writing mode">
            <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
              <div className="flex items-start justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Zen mode</p>
                  <p className="truncate text-sm font-medium">{watched.title || "Untitled post"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                    {wordCount.toLocaleString("en-IN")} words · {(watched.content ?? "").length.toLocaleString("en-IN")} chars
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="press-sm h-8 gap-2"
                    onClick={() => setZen(false)}
                  >
                    <Minimize className="size-3.5" aria-hidden="true" />
                    Exit
                  </Button>
                </div>
              </div>
              <MarkdownToolbar textareaRef={zenRef} onChange={setContentValue} />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem className="mt-3 flex min-h-0 flex-1 flex-col">
                    <FormControl>
                      <Textarea
                        {...field}
                        ref={zenRef}
                        value={field.value ?? ""}
                        autoFocus
                        placeholder={contentPlaceholder}
                        className="h-full min-h-0 w-full flex-1 resize-none font-mono text-[13px] leading-relaxed [field-sizing:fixed]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="pt-2 text-center text-[10px] text-muted-foreground">Esc exits zen mode</p>
            </div>
          </div>
        ) : null}
      </Form>
    </AdminShell>
  );
}
