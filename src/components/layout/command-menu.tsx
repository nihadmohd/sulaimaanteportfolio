"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  FileText,
  Package,
  Search,
  Shield,
  User,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Icon } from "@/components/shared/lucide-icon";
import { navigate } from "@/hooks/use-router";
import { isStaff, useSession } from "@/hooks/use-session";
import { useUiStore } from "@/stores/ui-store";
import { NAV_MAIN } from "@/lib/constants";

/**
 * CommandMenu — Ctrl/⌘+K palette. Static navigation section plus debounced
 * search across posts (/api/posts?q=) and products (/api/products?q=).
 * Search sections stay hidden until the APIs return results (graceful —
 * they may not exist yet in earlier waves).
 */

interface SearchHit {
  slug: string;
  title: string;
  kind: "post" | "product";
}

async function searchPosts(q: string): Promise<SearchHit[]> {
  try {
    const res = await fetch(`/api/posts?q=${encodeURIComponent(q)}&limit=5`);
    if (!res.ok) return [];
    const json = (await res.json()) as { ok: boolean; data?: { items?: Array<{ slug?: string; title?: string }> } };
    if (!json.ok || !Array.isArray(json.data?.items)) return [];
    return json.data.items
      .filter((item) => item.slug && item.title)
      .map((item) => ({ slug: String(item.slug), title: String(item.title), kind: "post" as const }));
  } catch {
    return [];
  }
}

async function searchProducts(q: string): Promise<SearchHit[]> {
  try {
    const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=5`);
    if (!res.ok) return [];
    const json = (await res.json()) as { ok: boolean; data?: { items?: Array<{ slug?: string; name?: string }> } };
    if (!json.ok || !Array.isArray(json.data?.items)) return [];
    return json.data.items
      .filter((item) => item.slug && item.name)
      .map((item) => ({ slug: String(item.slug), title: String(item.name), kind: "product" as const }));
  } catch {
    return [];
  }
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CommandMenu() {
  const { commandOpen, setCommandOpen } = useUiStore();
  const { user } = useSession();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search.trim(), 300);
  const ready = commandOpen && q.length >= 2;

  const postsQuery = useQuery({
    queryKey: ["command", "posts", q],
    queryFn: () => searchPosts(q),
    enabled: ready,
    staleTime: 60_000,
    retry: 1,
  });
  const productsQuery = useQuery({
    queryKey: ["command", "products", q],
    queryFn: () => searchProducts(q),
    enabled: ready,
    staleTime: 60_000,
    retry: 1,
  });

  const posts = ready ? (postsQuery.data ?? []) : [];
  const products = ready ? (productsQuery.data ?? []) : [];

  const go = (href: string) => {
    setCommandOpen(false);
    setSearch("");
    navigate(href);
  };

  return (
    <CommandDialog
      open={commandOpen}
      onOpenChange={(open) => {
        setCommandOpen(open);
        if (!open) setSearch("");
      }}
      title="MN.KP command menu"
      description="Search posts, products and pages — then hit Enter to jump there."
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search posts, products, pages..."
      />
      <CommandList className="max-h-[360px]">
        <CommandEmpty>No matches found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {NAV_MAIN.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)} className="gap-2">
              <Icon name={item.icon} className="size-4" />
              {item.label}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => go("/support")} className="gap-2">
            <Search className="size-4" aria-hidden="true" />
            Support & Help
          </CommandItem>
          <CommandItem onSelect={() => go("/legal")} className="gap-2">
            <FileText className="size-4" aria-hidden="true" />
            Legal & Policies
          </CommandItem>
        </CommandGroup>

        {user ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Account">
              <CommandItem onSelect={() => go("/account")} className="gap-2">
                <User className="size-4" aria-hidden="true" />
                Your account
              </CommandItem>
              {isStaff(user) ? (
                <CommandItem onSelect={() => go("/admin")} className="gap-2">
                  <Shield className="size-4" aria-hidden="true" />
                  Admin & Developer console
                </CommandItem>
              ) : null}
            </CommandGroup>
          </>
        ) : null}

        {q.length >= 2 ? (
          <>
            <CommandSeparator />
            {posts.length > 0 ? (
              <CommandGroup heading="Blog posts">
                {posts.map((hit) => (
                  <CommandItem key={`post-${hit.slug}`} onSelect={() => go(`/blog/${hit.slug}`)} className="gap-2">
                    <FileText className="size-4" aria-hidden="true" />
                    <span className="truncate">{hit.title}</span>
                    <ArrowRight className="ml-auto size-3.5 opacity-50" aria-hidden="true" />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {products.length > 0 ? (
              <CommandGroup heading="Store products">
                {products.map((hit) => (
                  <CommandItem
                    key={`product-${hit.slug}`}
                    onSelect={() => go(`/store/${hit.slug}`)}
                    className="gap-2"
                  >
                    <Package className="size-4" aria-hidden="true" />
                    <span className="truncate">{hit.title}</span>
                    <ArrowRight className="ml-auto size-3.5 opacity-50" aria-hidden="true" />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
