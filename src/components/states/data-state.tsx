"use client";

import * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { LoadingState } from "@/components/states/loading";
import { ErrorState } from "@/components/states/http-states";
import { EmptyState, NoResultsState, type EmptyVariant } from "@/components/states/empty";
import { useRouter } from "@/hooks/use-router";

/**
 * DataState — one wrapper for the whole TanStack query lifecycle:
 *   pending → LoadingState · error → ErrorState · empty → Empty/NoResults · else content.
 *
 * Usage:
 *   <DataState query={postsQuery} emptyVariant="posts" skeletonRows={6}>
 *     {(data) => <PostGrid posts={data.items} />}
 *   </DataState>
 *
 * When the current route has ?q= and the result is empty, NoResultsState
 * (clear-filters CTA) is rendered instead of EmptyState.
 */

export interface DataStateProps<T> {
  query: UseQueryResult<T>;
  emptyVariant?: EmptyVariant;
  /** Custom emptiness test (defaults to null/[]/{items:[]}). */
  empty?: boolean | ((data: T) => boolean);
  /** Skeleton rows while pending. */
  skeletonRows?: number;
  children: (data: T) => React.ReactNode;
}

function isDefaultEmpty<T>(data: T): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items.length === 0;
  }
  return false;
}

export function DataState<T>({
  query,
  emptyVariant = "generic",
  empty,
  skeletonRows = 4,
  children,
}: DataStateProps<T>) {
  const { query: urlQuery } = useRouter();
  const search = urlQuery.get("q");

  if (query.isPending) {
    return <LoadingState variant="skeleton" rows={skeletonRows} />;
  }
  if (query.isError) {
    const raw: unknown = query.error;
    const message =
      raw instanceof Error ? raw.message : typeof raw === "string" ? raw : null;
    return <ErrorState message={message} onRetry={() => query.refetch()} />;
  }

  const data = query.data as T;
  const isEmpty = typeof empty === "function" ? empty(data) : (empty ?? isDefaultEmpty(data));
  if (isEmpty) {
    if (search) return <NoResultsState query={search} />;
    return <EmptyState variant={emptyVariant} />;
  }

  return <>{children(data)}</>;
}
