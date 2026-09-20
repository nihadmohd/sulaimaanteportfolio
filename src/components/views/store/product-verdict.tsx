"use client";

import * as React from "react";
import { BadgeCheck, Check, RotateCcw, Scale, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductDTO } from "@/types";

/**
 * ProductVerdict — "Quick verdict — is it for you?" interactive widget.
 *
 * The reader taps the chips that match their situation (pros under
 * "Built for", cons under "Skip if"); a live verdict line and a
 * proportional meter react instantly:
 *   · pros > cons  → strong match (copper positive copy)
 *   · cons > pros  → cautious copy
 *   · tie / none   → neutral prompt
 * Pure client state; hidden entirely when a product has neither pros
 * nor cons. Resets when navigating between products.
 */

export interface ProductVerdictProps {
  product: ProductDTO;
}

export function ProductVerdict({ product }: ProductVerdictProps) {
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
     
    setSelected({});
  }, [product.slug]);

  const { pros, cons } = product;
  if (pros.length === 0 && cons.length === 0) return null;

  const toggle = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const proCount = pros.filter((pro) => selected[pro]).length;
  const conCount = cons.filter((con) => selected[con]).length;
  const total = proCount + conCount;

  let verdict: { tone: "good" | "warn" | "neutral"; text: string };
  if (proCount > conCount) {
    verdict = {
      tone: "good",
      text: `Strong match — ${proCount} green flag${proCount === 1 ? "" : "s"} vs ${conCount} caveat${
        conCount === 1 ? "" : "s"
      }. This fits your workflow.`,
    };
  } else if (conCount > proCount) {
    verdict = {
      tone: "warn",
      text: `Think twice — ${conCount} caveat${conCount === 1 ? "" : "s"} vs ${proCount} green flag${
        proCount === 1 ? "" : "s"
      }.`,
    };
  } else {
    verdict = { tone: "neutral", text: "Tap what applies to you — I'll call the verdict." };
  }

  const chipBase =
    "press-sm inline-flex items-start gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium leading-snug transition-colors";

  return (
    <section className="mt-8" aria-label="Quick verdict — is it for you?">
      <h2 className="text-lg font-semibold tracking-tight">Quick verdict — is it for you?</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Tap the points that match your situation — the verdict updates live.
      </p>

      <div className="mt-4 rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pros.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Built for
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pros.map((pro) => (
                  <button
                    key={pro}
                    type="button"
                    aria-pressed={Boolean(selected[pro])}
                    onClick={() => toggle(pro)}
                    className={cn(
                      chipBase,
                      selected[pro]
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    <Check className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    {pro}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {cons.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Skip if
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cons.map((con) => (
                  <button
                    key={con}
                    type="button"
                    aria-pressed={Boolean(selected[con])}
                    onClick={() => toggle(con)}
                    className={cn(
                      chipBase,
                      selected[con]
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-border bg-background text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                    )}
                  >
                    <X className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    {con}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t pt-3">
          {/* proportional meter: selected pros (primary) vs cons (muted) */}
          <div
            className="flex h-1.5 overflow-hidden rounded-full bg-muted"
            role="presentation"
            aria-hidden="true"
          >
            <div
              className="h-full bg-primary transition-all duration-300 motion-reduce:transition-none"
              style={{ width: total > 0 ? `${(proCount / total) * 100}%` : "0%" }}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p
              aria-live="polite"
              className={cn(
                "flex min-w-0 items-start gap-1.5 text-xs leading-relaxed sm:text-sm",
                verdict.tone === "good" && "font-medium text-gold",
                verdict.tone === "warn" && "font-medium text-amber-600 dark:text-amber-400",
                verdict.tone === "neutral" && "text-muted-foreground"
              )}
            >
              {verdict.tone === "good" ? (
                <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : verdict.tone === "warn" ? (
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Scale className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span>{verdict.text}</span>
            </p>

            {total > 0 ? (
              <button
                type="button"
                onClick={() => setSelected({})}
                className="press-sm inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
