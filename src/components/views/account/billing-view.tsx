"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Info,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ALink } from "@/components/router/link";
import { useSession } from "@/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/shared/seo-head";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { DataState } from "@/components/states/data-state";
import { EmptyState } from "@/components/states/empty";
import { PaymentState } from "@/components/states/http-states";
import { formatINR } from "@/components/shared/product-card";
import { apiFetch } from "@/components/views/auth/_shared";
import {
  formatDate,
  subStatusBadge,
  subStatusLabel,
  renewalNote,
} from "./_shared";
import type { PlanDTO, SubscriptionDTO, SubscriptionEventDTO, SubscriptionsResponse } from "@/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

interface ManageReply {
  subscription: SubscriptionDTO;
  event: SubscriptionEventDTO;
}

type PaymentOutcome = "success" | "failed" | "pending";

interface PendingPlan {
  plan: PlanDTO;
  interval: "monthly" | "yearly";
}

interface PaymentBanner {
  outcome: PaymentOutcome;
  planName: string;
  interval: "monthly" | "yearly";
  amount: number;
  event: SubscriptionEventDTO;
}

const EVENT_LABELS: Record<string, string> = {
  created: "Subscribed",
  plan_changed: "Plan changed",
  interval_changed: "Interval changed",
  renewed: "Renewed",
  canceled: "Cancellation scheduled",
  resumed: "Resumed",
  payment_succeeded: "Payment",
  payment_failed: "Payment failed",
  payment_pending: "Payment pending",
  trial_ended: "Trial ended",
};

function eventBadgeClass(type: string): string {
  if (type === "payment_succeeded") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (type === "payment_failed") return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
  if (type === "payment_pending") return "border-gold/40 bg-gold/10 text-gold";
  if (type === "canceled") return "border-muted bg-muted text-muted-foreground";
  return "border-gold/30 bg-gold/10 text-gold";
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

/**
 * #/account/billing (route key account-billing, guard auth) — plan
 * management with the mock payment dialog, cancel/resume flow and the
 * invoice / activity history table.
 */
export default function BillingView() {
  const { refetch: refetchSession } = useSession();
  const [interval, setInterval] = React.useState<"monthly" | "yearly">("monthly");
  const [pendingPlan, setPendingPlan] = React.useState<PendingPlan | null>(null);
  const [banner, setBanner] = React.useState<PaymentBanner | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<"cancel" | "resume" | null>(null);
  const [busy, setBusy] = React.useState(false);

  const subsQuery = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => apiFetch<SubscriptionsResponse>("/api/subscriptions"),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const plansSectionRef = React.useRef<HTMLDivElement | null>(null);
  const historyRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToPlans = () => {
    plansSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Shared POST /api/subscriptions/manage wrapper. */
  const runManage = async (body: Record<string, unknown>): Promise<ManageReply | null> => {
    setBusy(true);
    try {
      const data = await apiFetch<ManageReply>("/api/subscriptions/manage", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await Promise.all([subsQuery.refetch(), refetchSession()]);
      return data;
    } catch (e) {
      toast({
        title: "Billing action failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** change + outcome → refetch + banner. */
  const changePlan = async (plan: PlanDTO, selectedInterval: "monthly" | "yearly", outcome: PaymentOutcome) => {
    const amount = selectedInterval === "yearly" ? plan.priceYearly : plan.priceMonthly;
    const reply = await runManage({
      action: "change",
      planCode: plan.code,
      interval: selectedInterval,
      paymentOutcome: outcome,
    });
    setPendingPlan(null);
    if (!reply) return;
    setBanner({ outcome, planName: plan.name, interval: selectedInterval, amount, event: reply.event });
    if (outcome === "success") {
      toast({ title: `${plan.name} activated`, description: `Billed ${formatINR(amount)} (${selectedInterval}).` });
    }
  };

  const cancelSubscription = async () => {
    setConfirmAction(null);
    const reply = await runManage({ action: "cancel" });
    if (!reply) return;
    toast({
      title: "Cancellation scheduled",
      description: "Your plan stays active until the end of the current period.",
    });
    setBanner(null);
  };

  const resumeSubscription = async () => {
    setConfirmAction(null);
    const reply = await runManage({ action: "resume" });
    if (!reply) return;
    toast({ title: "Subscription resumed", description: "Automatic renewals are back on." });
    setBanner(null);
  };

  const retryPayment = async () => {
    const data = subsQuery.data;
    if (data?.current) {
      const reply = await runManage({ action: "renew", paymentOutcome: "success" });
      if (!reply) return;
      setBanner({
        outcome: "success",
        planName: reply.subscription.plan.name,
        interval: reply.subscription.billingInterval,
        amount: reply.event.amount ?? 0,
        event: reply.event,
      });
      toast({ title: "Payment retried successfully", description: "Your subscription is active again." });
    }
  };

  return (
    <>
      <SEOHead
        title="Billing & Subscription | MN.KP"
        description="Manage your MN.KP subscription, plan and billing history."
        canonicalPath="/account/billing"
        noindex
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <Breadcrumbs
          items={[{ label: "Home", href: "#/" }, { label: "Account", href: "#/account" }, { label: "Billing" }]}
        />

        <header className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Account · Billing
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Billing &amp; subscription
          </h1>
          <div aria-hidden="true" className="gold-rule mt-4 w-24" />
        </header>

        <DataState query={subsQuery} skeletonRows={8}>
          {(data) => {
            const current = data.current;
            const currentPlan = current?.plan ?? null;
            const price = current
              ? current.billingInterval === "yearly"
                ? current.plan.priceYearly
                : current.plan.priceMonthly
              : 0;

            return (
              <div className="mt-8 space-y-8">
                {/* outcome banner */}
                {banner ? (
                  <div ref={historyRef} aria-live="polite" className="space-y-3">
                    {banner.outcome === "success" ? (
                      <>
                        <PaymentState
                          status="success"
                          message={`${banner.planName} activated — ${banner.interval} billing, ${formatINR(
                            banner.amount
                          )} charged to Visa ·· 4242 (demo). The receipt below is also appended to your history.`}
                          action={
                            <Button variant="outline" onClick={() => setBanner(null)}>
                              Dismiss
                            </Button>
                          }
                        />
                        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-1 rounded-xl border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
                          <span>
                            Receipt <span className="font-mono text-foreground">#{banner.event.id.slice(0, 8).toUpperCase()}</span>
                          </span>
                          <span>
                            Amount <span className="font-medium text-foreground">{formatINR(banner.amount)}</span>
                          </span>
                          <span>
                            Date <span className="font-medium text-foreground">{formatDate(banner.event.createdAt)}</span>
                          </span>
                          <span>
                            Method <span className="font-medium text-foreground">Visa ·· 4242</span>
                          </span>
                        </div>
                      </>
                    ) : banner.outcome === "failed" ? (
                      <PaymentState
                        status="failed"
                        message={`The ${formatINR(banner.amount)} charge for ${banner.planName} (${banner.interval}) was declined. Your subscription is now marked past due — retry now or from the current plan card.`}
                        onRetry={() => void retryPayment()}
                        action={
                          <Button variant="ghost" onClick={() => setBanner(null)}>
                            Dismiss
                          </Button>
                        }
                      />
                    ) : (
                      <PaymentState
                        status="pending"
                        message={`${formatINR(banner.amount)} for ${banner.planName} (${banner.interval}) is awaiting confirmation. Your subscription shows as trialing until the payment settles.`}
                        action={
                          <Button variant="outline" onClick={() => setBanner(null)}>
                            Dismiss
                          </Button>
                        }
                      />
                    )}
                  </div>
                ) : null}

                {/* current plan card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                      <span className="flex items-center gap-2">
                        <CreditCard className="size-4 text-gold" aria-hidden="true" />
                        Current plan
                      </span>
                      {current ? (
                        <Badge variant="outline" className={subStatusBadge(current.status)}>
                          {subStatusLabel(current.status)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted bg-muted text-muted-foreground">
                          Free Reader
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div className="max-w-xl">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <p className="text-xl font-semibold">
                            {current ? current.plan.name : "Free Reader"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {current
                              ? `${formatINR(price)} / ${current.billingInterval === "yearly" ? "year" : "month"}`
                              : "Included — no card needed"}
                          </p>
                        </div>
                        {current ? (
                          <>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {renewalNote(current)}
                            </p>
                            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                              <div>
                                <dt className="text-xs text-muted-foreground">Period ends</dt>
                                <dd className="font-medium">{formatDate(current.currentPeriodEnd)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">Payment method</dt>
                                <dd className="font-medium">
                                  {current.paymentBrand ?? "Visa"} ·· {current.paymentLast4 ?? "4242"} (demo)
                                </dd>
                              </div>
                            </dl>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Every published post and store listing, weekly digest, personal account.
                          </p>
                        )}
                        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                          {(current ? current.plan.features : data.plans.find((p) => p.code === "free")?.features ?? []).map(
                            (feature) => (
                              <li key={feature} className="flex items-start gap-2">
                                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                                <span>{feature}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>

                      <div className="flex w-full flex-col gap-2 md:w-auto">
                        <Button
                          onClick={scrollToPlans}
                          className="h-11 w-full gap-2 bg-primary font-medium text-primary-foreground hover:bg-primary/90 md:w-auto"
                        >
                          <Sparkles className="size-4" aria-hidden="true" />
                          Change plan
                        </Button>
                        {current ? (
                          <>
                            {current.cancelAtPeriodEnd ? (
                              <Button
                                variant="outline"
                                className="h-11 w-full gap-2 md:w-auto"
                                disabled={busy}
                                onClick={() => setConfirmAction("resume")}
                              >
                                <RefreshCw className="size-4" aria-hidden="true" />
                                Resume subscription
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                className="h-11 w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive md:w-auto"
                                disabled={busy}
                                onClick={() => setConfirmAction("cancel")}
                              >
                                Cancel subscription
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              className="h-11 w-full gap-2 text-muted-foreground md:w-auto"
                              disabled={busy}
                              onClick={() => void runManage({ action: "renew", paymentOutcome: "success" })}
                            >
                              <CalendarClock className="size-4" aria-hidden="true" />
                              Renew now
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* plans grid */}
                <div ref={plansSectionRef} id="plans" className="scroll-mt-24">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Plans
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
                        Choose your pace
                      </h2>
                    </div>
                    <div
                      role="group"
                      aria-label="Billing interval"
                      className="inline-flex rounded-lg border bg-muted/40 p-1"
                    >
                      {(["monthly", "yearly"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={interval === option}
                          onClick={() => setInterval(option)}
                          className={cn(
                            "h-10 rounded-md px-4 text-sm font-medium transition-colors",
                            interval === option
                              ? "bg-gold/15 text-gold shadow-[0_0_0_1px_var(--gold)]"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {option === "monthly" ? "Monthly" : "Yearly"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 md:grid-cols-3">
                    {data.plans.map((plan) => {
                      const isCurrent = !!current && current.plan.code === plan.code;
                      const amount = interval === "yearly" ? plan.priceYearly : plan.priceMonthly;
                      const currentSort = currentPlan?.sortOrder ?? -1;
                      const isUpgrade = plan.sortOrder > currentSort;
                      const sameInterval = isCurrent && current?.billingInterval === interval;
                      return (
                        <Card
                          key={plan.id}
                          className={cn(
                            "relative flex flex-col",
                            isCurrent && "border-gold shadow-[0_0_0_1px_var(--gold)]"
                          )}
                        >
                          {plan.code === "business" ? (
                            <Badge className="absolute -top-2.5 right-4 gap-1 bg-gold text-gold-foreground hover:bg-gold">
                              <Sparkles className="size-3" aria-hidden="true" />
                              Popular
                            </Badge>
                          ) : null}
                          <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-base">{plan.name}</CardTitle>
                              {isCurrent ? (
                                <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
                                  Current plan
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-2 flex items-baseline gap-1.5">
                              <span className="text-2xl font-semibold tracking-tight">
                                {amount === 0 ? "Included" : formatINR(amount)}
                              </span>
                              {amount > 0 ? (
                                <span className="text-sm text-muted-foreground">
                                  /{interval === "yearly" ? "year" : "month"}
                                </span>
                              ) : null}
                            </div>
                            {plan.description ? (
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {plan.description}
                              </p>
                            ) : null}
                            {isCurrent && current ? (
                              <p className="mt-1 text-xs text-gold">
                                You're billed {current.billingInterval}.
                              </p>
                            ) : null}
                          </CardHeader>
                          <CardContent className="flex flex-1 flex-col">
                            <ul className="flex-1 space-y-2 text-sm">
                              {plan.features.map((feature) => (
                                <li key={feature} className="flex items-start gap-2">
                                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                            <Button
                              className="mt-5 h-11 w-full gap-1.5 font-medium"
                              variant={isUpgrade ? "default" : "outline"}
                              disabled={busy || sameInterval}
                              onClick={() => {
                                if (amount === 0) {
                                  void changePlan(plan, interval, "success");
                                } else {
                                  setPendingPlan({ plan, interval });
                                }
                              }}
                            >
                              {!isCurrent && isUpgrade ? (
                                <ArrowUpRight className="size-4" aria-hidden="true" />
                              ) : !isCurrent && !isUpgrade ? (
                                <ArrowDownRight className="size-4" aria-hidden="true" />
                              ) : (
                                <RefreshCw className="size-4" aria-hidden="true" />
                              )}
                              {sameInterval
                                ? "Current plan"
                                : isCurrent
                                  ? `Switch to ${interval}`
                                  : isUpgrade
                                    ? "Upgrade"
                                    : "Downgrade"}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* history */}
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Invoices &amp; activity
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
                        Billing history
                      </h2>
                    </div>
                  </div>
                  {data.history.length === 0 ? (
                    <div className="mt-4">
                      <EmptyState variant="inbox" title="No billing activity yet" />
                    </div>
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[38%]">Event</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="hidden text-right sm:table-cell">Interval</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.history.map((event) => {
                            const interval = typeof event.payload?.interval === "string" ? (event.payload.interval as string) : null;
                            return (
                              <TableRow key={event.id}>
                                <TableCell>
                                  <Badge variant="outline" className={eventBadgeClass(event.type)}>
                                    {EVENT_LABELS[event.type] ?? event.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {formatDate(event.createdAt)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {event.amount != null ? formatINR(event.amount) : "—"}
                                </TableCell>
                                <TableCell className="hidden text-right text-sm text-muted-foreground sm:table-cell">
                                  {interval ?? "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* demo note */}
                <Card className="border-dashed">
                  <CardContent className="flex items-start gap-3 pt-2 text-sm text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                    <p>
                      <span className="font-medium text-foreground">Demo billing — no real charges.</span>{" "}
                      Payments here run through a mock gateway with a simulated card
                      (Visa ·· 4242). On production this is wired to a payment provider
                      with the same buttons, receipts and dunning flow.
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          }}
        </DataState>
      </div>

      {/* cancel / resume confirmations */}
      <AlertDialog
        open={confirmAction === "cancel"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll keep {subsQuery.data?.current?.plan.name ?? "your plan"} until the end
              of the current period ({formatDate(subsQuery.data?.current?.currentPeriodEnd)}),
              then drop to Free Reader. No early fees.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Keep my plan</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void cancelSubscription()}
            >
              Schedule cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={confirmAction === "resume"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume automatic renewals?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will renew normally and the scheduled cancellation
              will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Leave as scheduled</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => void resumeSubscription()}
            >
              Resume subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* mock payment dialog */}
      <Dialog open={pendingPlan !== null} onOpenChange={(open) => !open && setPendingPlan(null)}>
        <DialogContent className="sm:max-w-md">
          {pendingPlan ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-gold" aria-hidden="true" />
                  Secure checkout (demo)
                </DialogTitle>
                <DialogDescription>
                  Paying {formatINR(pendingPlan.interval === "yearly" ? pendingPlan.plan.priceYearly : pendingPlan.plan.priceMonthly)} for{" "}
                  {pendingPlan.plan.name} · {pendingPlan.interval} billing.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Card number</p>
                  <Input
                    value="4242 4242 4242 4242"
                    disabled
                    aria-label="Demo card number"
                    className="mt-1 h-11 font-mono opacity-70"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Expiry</p>
                    <Input value="12 / 29" disabled aria-label="Demo card expiry" className="mt-1 h-11 font-mono opacity-70" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">CVV</p>
                    <Input value="···" disabled aria-label="Demo card CVV" className="mt-1 h-11 font-mono opacity-70" />
                  </div>
                </div>
                <p className="rounded-lg border border-dashed border-gold/40 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
                  Test card pre-filled by the mock gateway. Nothing is charged —
                  the outcome is simulated below.
                </p>
              </div>

              <DialogFooter className="flex-col gap-3 sm:flex-col">
                <Button
                  className="h-11 w-full gap-2 bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                  disabled={busy}
                  onClick={() => void changePlan(pendingPlan.plan, pendingPlan.interval, "success")}
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Pay{" "}
                  {formatINR(
                    pendingPlan.interval === "yearly" ? pendingPlan.plan.priceYearly : pendingPlan.plan.priceMonthly
                  )}{" "}
                  securely (demo)
                </Button>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>Simulate:</span>
                  {(["success", "failed", "pending"] as const).map((outcome) => (
                    <Button
                      key={outcome}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={busy}
                      onClick={() => void changePlan(pendingPlan.plan, pendingPlan.interval, outcome)}
                    >
                      {outcome}
                    </Button>
                  ))}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
