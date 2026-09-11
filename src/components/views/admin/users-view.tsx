"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Switch } from "@/components/ui/switch";
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
import type { Paginated, SafeUser, UserRole } from "@/types";
import { AdminShell } from "./_shell";
import {
  AdminPager,
  apiFetch,
  CopyText,
  fmtDate,
  RoleBadge,
  timeAgo,
  useAdminGuard,
  useDebounced,
} from "./_shared";

/**
 * Users admin (#/admin/users — route key "admin-users").
 * Search + role tabs, server-side pagination. Inline role Select + active
 * Switch PATCH (self row disabled with a "You" badge), onboarding chip,
 * last-login time-ago.
 */

type RoleTab = "all" | "reader" | "author" | "editor" | "admin";
const PAGE_SIZE = 20;
const ROLE_VALUES: UserRole[] = ["reader", "author", "editor", "admin"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function UsersView() {
  const { user: me, isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [role, setRole] = React.useState<RoleTab>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const q = useDebounced(search);

  React.useEffect(() => {
    setPage(1);
  }, [role, q]);

  const usersQuery = useQuery({
    queryKey: ["admin-users", role, q, page],
    queryFn: () =>
      apiFetch<Paginated<SafeUser>>(
        `/api/users?page=${page}&limit=${PAGE_SIZE}` +
          `${role !== "all" ? `&role=${role}` : ""}` +
          `${q ? `&q=${encodeURIComponent(q)}` : ""}`
      ),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const updateMutation = useMutation({
    mutationFn: ({ user, body }: { user: SafeUser; body: Record<string, unknown> }) =>
      apiFetch<SafeUser>(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (updated) => {
      toast({
        title: "User updated",
        description: `${updated.fullName || updated.email} — ${updated.role}${updated.isActive ? "" : " (deactivated)"}`,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading users" />;
  if (!allowed) return <ForbiddenState />;

  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell
      title="Users"
      description="Accounts, roles and access — demote or deactivate with care."
    >
      <SEOHead title="Users — Admin & Developer | MN.KP" noindex />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            aria-label="Search users"
            className="h-10 pl-9"
          />
        </div>
        <Tabs value={role} onValueChange={(v) => setRole(v as RoleTab)} aria-label="Filter by role">
          <TabsList className="h-10 w-full sm:w-auto">
            <TabsTrigger value="all" className="h-8">All</TabsTrigger>
            <TabsTrigger value="reader" className="h-8">Readers</TabsTrigger>
            <TabsTrigger value="author" className="h-8">Authors</TabsTrigger>
            <TabsTrigger value="editor" className="h-8">Editors</TabsTrigger>
            <TabsTrigger value="admin" className="h-8">Admins</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DataState query={usersQuery} emptyVariant="generic" skeletonRows={6}>
        {(data) => (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((user) => {
                    const isSelf = me?.id === user.id;
                    return (
                      <TableRow key={user.id} className={isSelf ? "bg-gold/[0.04]" : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9 border">
                              {user.avatarUrl ? (
                                <AvatarImage src={user.avatarUrl} alt={user.fullName || user.email} />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                {initials(user.fullName || user.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 truncate font-medium">
                                {user.fullName || "Unnamed"}
                                {isSelf ? (
                                  <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
                                    You
                                  </Badge>
                                ) : null}
                              </p>
                              <CopyText value={user.email} label="Email" className="text-xs text-muted-foreground" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isSelf ? (
                            <RoleBadge role={user.role} />
                          ) : (
                            <Select
                              value={user.role}
                              onValueChange={(v) =>
                                updateMutation.mutate({ user, body: { role: v } })
                              }
                              disabled={updateMutation.isPending}
                            >
                              <SelectTrigger
                                className="h-9 w-[120px] text-xs"
                                aria-label={`Role for ${user.email}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_VALUES.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={user.isActive}
                            disabled={isSelf || updateMutation.isPending}
                            onCheckedChange={(checked) =>
                              updateMutation.mutate({ user, body: { isActive: checked } })
                            }
                            aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${user.email}`}
                          />
                        </TableCell>
                        <TableCell>
                          {user.onboardingCompleted ? (
                            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                              Done
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Step {user.onboardingStep}/4
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {timeAgo(user.lastLoginAt)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(user.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <AdminPager page={page} totalPages={totalPages} total={total} onChange={setPage} />
            <p className="text-xs text-muted-foreground">
              Your own role and active status are locked — ask another admin for changes.
            </p>
          </div>
        )}
      </DataState>
    </AdminShell>
  );
}
