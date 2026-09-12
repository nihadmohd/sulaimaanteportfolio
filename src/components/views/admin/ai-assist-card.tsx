"use client";

import * as React from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { apiFetch, ConfirmAction } from "./_shared";

/**
 * AiAssistCard — the flagship editor power-feature (Task 12-b).
 *
 * A copper-accented sidebar card that calls POST /api/ai/assist for a
 * small set of one-click generation actions. The card owns the request
 * lifecycle (pending spinner, destructive-error toasts) and the result
 * panel; the PARENT owns what "apply" means per action via two callbacks:
 *
 *   buildRequest(action) → request body  (may throw a friendly Error when
 *     prerequisites are missing — the card surfaces it as a toast)
 *   applyResult(action, text) → mutate the right form field
 *   confirmFor(action) → when Insert should be guarded by ConfirmAction
 *     (used for proofread / description replacements)
 *
 * Title results are special: a numbered list is parsed into clickable
 * headline rows instead of a raw Insert.
 */

export type AiAssistAction =
  | "title"
  | "excerpt"
  | "tags"
  | "outline"
  | "continue"
  | "proofread"
  | "description";

export interface AiAssistOption {
  action: AiAssistAction;
  label: string;
}

export interface AiAssistConfirm {
  title: string;
  description: React.ReactNode;
}

interface AiAssistResult {
  action: AiAssistAction;
  text: string;
}

interface AssistResponse {
  action: string;
  text: string;
}

/** "1. Some headline" / "2) Another" → clean headline strings. */
function parseTitleOptions(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const match = raw.match(/^\s*\d+[.)]\s+(.+?)\s*$/);
    if (match) {
      out.push(match[1].replace(/^["'“”]+|["'“”]+$/g, "").trim());
    }
  }
  return out.filter(Boolean);
}

export function AiAssistCard({
  heading = "AI assist",
  subline,
  actions,
  buildRequest,
  applyResult,
  confirmFor,
}: {
  heading?: string;
  subline?: string;
  actions: AiAssistOption[];
  buildRequest: (action: AiAssistAction) => Record<string, unknown>;
  applyResult: (action: AiAssistAction, text: string) => void;
  confirmFor?: (action: AiAssistAction) => AiAssistConfirm | null;
}) {
  const [pending, setPending] = React.useState<AiAssistAction | null>(null);
  const [result, setResult] = React.useState<AiAssistResult | null>(null);

  const run = async (action: AiAssistAction) => {
    setPending(action);
    setResult(null);
    try {
      const body = buildRequest(action);
      const data = await apiFetch<AssistResponse>("/api/ai/assist", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const text = (data.text ?? "").trim();
      if (!text) {
        throw new Error("The AI returned an empty response. Please try again.");
      }
      setResult({ action, text });
    } catch (e) {
      toast({
        title: "AI assist failed",
        description: e instanceof Error ? e.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setPending(null);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      toast({ title: "Copied", description: "AI output copied to your clipboard." });
    } catch {
      toast({ title: "Could not copy", description: "Select the text and copy manually.", variant: "destructive" });
    }
  };

  const apply = (action: AiAssistAction, text: string) => {
    applyResult(action, text);
    setResult(null);
  };

  const titleOptions =
    result?.action === "title" ? parseTitleOptions(result.text) : null;
  const useTitleRows = !!titleOptions && titleOptions.length >= 2;
  const confirm = result ? (confirmFor?.(result.action) ?? null) : null;

  return (
    <Card className="border-gold/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-gold">
          <Sparkles className="size-4 shrink-0" aria-hidden="true" />
          {heading}
        </CardTitle>
        {subline ? <p className="text-xs text-muted-foreground">{subline}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {actions.map(({ action, label }) => (
            <Button
              key={action}
              type="button"
              variant="outline"
              size="sm"
              className="press-sm h-8 gap-1.5 px-2 text-xs"
              disabled={pending != null}
              onClick={() => void run(action)}
            >
              {pending === action ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {label}
            </Button>
          ))}
        </div>

        {pending ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground"
          >
            <Loader2 className="size-3.5 animate-spin text-gold" aria-hidden="true" />
            Thinking...
          </p>
        ) : null}

        {result ? (
          <div className="space-y-2 rounded-lg border border-gold/30 bg-gold/5 p-3">
            {useTitleRows && titleOptions ? (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
                  Pick a headline
                </p>
                {titleOptions.map((option, i) => (
                  <button
                    key={`${i}-${option}`}
                    type="button"
                    onClick={() => apply("title", option)}
                    className="press-sm block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <pre className="scrollbar-slim max-h-64 overflow-y-auto break-words whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                {result.text}
              </pre>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {useTitleRows ? null : confirm ? (
                <ConfirmAction
                  trigger={
                    <Button type="button" size="sm" className="press-sm h-8">
                      Insert
                    </Button>
                  }
                  title={confirm.title}
                  description={confirm.description}
                  confirmLabel="Replace"
                  buttonVariant="default"
                  onConfirm={() => apply(result.action, result.text)}
                />
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="press-sm h-8"
                  onClick={() => apply(result.action, result.text)}
                >
                  Insert
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="press-sm h-8 gap-1.5"
                onClick={() => void copy()}
              >
                <Copy className="size-3.5" aria-hidden="true" />
                Copy
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="press-sm h-8 text-muted-foreground"
                onClick={() => setResult(null)}
              >
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
