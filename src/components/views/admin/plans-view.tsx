"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import type { PlanDTO } from "@/types";
import { AdminShell } from "./_shell";
import { apiFetch, formatINR, useAdminGuard } from "./_shared";

/**
 * Plans admin (#/admin/plans — route key "admin-plans").
 * Plan cards with prices/features/badges + Edit dialog → PATCH /api/plans/:id
 * (isDefault=true unsets the other plans server-side).
 */

interface PlanFormState {
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  features: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: string;
}

function stateFromPlan(plan: PlanDTO): PlanFormState {
  return {
    name: plan.name,
    description: plan.description ?? "",
    priceMonthly: String(plan.priceMonthly),
    priceYearly: String(plan.priceYearly),
    features: plan.features.join("\n"),
    isActive: plan.isActive,
    isDefault: plan.isDefault,
    sortOrder: String(plan.sortOrder),
  };
}

export default function PlansView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const [editing, setEditing] = React.useState<PlanDTO | null>(null);
  const [form, setForm] = React.useState<PlanFormState | null>(null);
  const [saving, setSaving] = React.useState(false);

  const plansQuery = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => apiFetch<PlanDTO[]>("/api/plans"),
    enabled: allowed,
    staleTime: 60_000,
    retry: 1,
  });

  const saveMutation = useMutation({
    mutationFn: ({ plan, state }: { plan: PlanDTO; state: PlanFormState }) =>
      apiFetch<PlanDTO>(`/api/plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: state.name,
          description: state.description || undefined,
          priceMonthly: Number(state.priceMonthly || 0),
          priceYearly: Number(state.priceYearly || 0),
          features: state.features
            .split("\n")
            .map((f) => f.trim())
            .filter(Boolean)
            .slice(0, 12),
          isActive: state.isActive,
          isDefault: state.isDefault,
          sortOrder: Number(state.sortOrder || 0),
        }),
      }),
    onSuccess: (updated) => {
      toast({ title: "Plan saved", description: `${updated.name} updated.` });
      setEditing(null);
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading plans" />;
  if (!allowed) return <ForbiddenState />;

  const openEdit = (plan: PlanDTO) => {
    setEditing(plan);
    setForm(stateFromPlan(plan));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync({ plan: editing, state: form });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Plans"
      description="The billing catalog — Free, Pro and Business pricing."
    >
      <SEOHead title="Plans — Admin & Developer | MN.KP" noindex />

      <DataState query={plansQuery} emptyVariant="generic" skeletonRows={3}>
        {(plans) => (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={
                  plan.isDefault
                    ? "border-gold/50 shadow-md"
                    : plan.code === "business"
                      ? "border-primary/40"
                      : undefined
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold tracking-tight">{plan.name}</p>
                      {plan.isDefault ? (
                        <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
                          Default
                        </Badge>
                      ) : null}
                      {!plan.isActive ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          Hidden
                        </Badge>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => openEdit(plan)}
                      aria-label={`Edit ${plan.name} plan`}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">code: {plan.code}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tabular-nums tracking-tight">
                      {formatINR(plan.priceMonthly)}
                    </span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    or {formatINR(plan.priceYearly)} / year
                  </p>
                  {plan.description ? (
                    <p className="mt-3 text-sm text-foreground/80">{plan.description}</p>
                  ) : null}
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-foreground/85">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Sort {plan.sortOrder} · {plan.currency}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DataState>

      {/* Edit dialog */}
      <Dialog open={!!editing && !!form} onOpenChange={(open) => !open && (setEditing(null), setForm(null))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit plan — {editing?.name}</DialogTitle>
            <DialogDescription>
              Changes apply to new subscriptions immediately; active ones keep their period.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plan-name">Name</Label>
                  <Input
                    id="plan-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-sort">Sort order</Label>
                  <Input
                    id="plan-sort"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-monthly">Monthly price (INR)</Label>
                  <Input
                    id="plan-monthly"
                    value={form.priceMonthly}
                    onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                    inputMode="numeric"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-yearly">Yearly price (INR)</Label>
                  <Input
                    id="plan-yearly"
                    value={form.priceYearly}
                    onChange={(e) => setForm({ ...form, priceYearly: e.target.value })}
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-desc">Description</Label>
                <Input
                  id="plan-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={300}
                  placeholder="One-line pitch (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-features">Features (one per line, max 12)</Label>
                <Textarea
                  id="plan-features"
                  value={form.features}
                  onChange={(e) => setForm({ ...form, features: e.target.value })}
                  rows={6}
                  placeholder={"Everything in Free\nPriority support"}
                  className="font-mono text-[13px]"
                />
              </div>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="plan-active"
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  />
                  <Label htmlFor="plan-active">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="plan-default"
                    checked={form.isDefault}
                    onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                  />
                  <Label htmlFor="plan-default" className="flex items-center gap-1">
                    <Star className="size-3.5 text-gold" aria-hidden="true" />
                    Default (unsets others)
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => (setEditing(null), setForm(null))}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save plan"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
