"use client";

import * as React from "react";
import { Check, Mail, MapPin, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALink } from "@/components/router/link";
import { Icon } from "@/components/shared/lucide-icon";
import { resolveFooter, useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { SITE, SOCIALS } from "@/lib/constants";

/**
 * SiteFooter — admin-editable via GET /api/settings (data?.footer with
 * FOOTER_DEFAULT fallback). Rich internal linking for SEO: brand block,
 * three link columns (2-col compact grid on mobile), socials, newsletter
 * mini-form and a legal bottom bar. The root carries bottom padding on
 * mobile so the fixed bottom tab bar (MobileNav) never overlaps content,
 * including safe-area-inset-bottom.
 */

function NewsletterForm() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "done">("idle");

  const subscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.includes("@") || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message?: string } };
      if (!json.ok) throw new Error(json.error?.message ?? "Could not subscribe right now.");
      setState("done");
      toast({
        title: "You are in",
        description: "Newsletter confirmed — welcome to the MN.KP inner circle.",
      });
    } catch (error) {
      setState("idle");
      toast({
        title: "Could not subscribe",
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  if (state === "done") {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary">
        <Check className="size-4 shrink-0" aria-hidden="true" />
        You are in — expect the next dispatch soon.
      </p>
    );
  }

  return (
    <form onSubmit={subscribe} className="flex w-full max-w-sm gap-2" aria-label="Newsletter signup">
      <label htmlFor="footer-newsletter" className="sr-only">
        Email address
      </label>
      <Input
        id="footer-newsletter"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        className="h-10 bg-card"
      />
      <Button type="submit" size="sm" className="h-10 shrink-0 gap-1.5" disabled={state === "sending"}>
        <Send className="size-3.5" aria-hidden="true" />
        {state === "sending" ? "Joining" : "Subscribe"}
      </Button>
    </form>
  );
}

export function SiteFooter() {
  const settings = useSettings();
  const footer = resolveFooter(settings.data);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full border-t bg-muted/40 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 md:px-6 md:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-8">
          {/* Brand block */}
          <div className="col-span-2 max-w-xs md:col-span-1">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="MN.KP monogram crest" className="h-9 w-9" width={36} height={36} loading="lazy" />
              <p className="text-lg font-semibold tracking-tight">
                MN<span className="text-gold">.KP</span>
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{footer.tagline}</p>

            <ul className="mt-4 space-y-2 text-xs text-muted-foreground sm:mt-5 sm:space-y-2.5 sm:text-sm">
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
                >
                  <Mail className="size-3.5 text-gold" aria-hidden="true" />
                  {SITE.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:+${SITE.phoneRaw}`}
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
                >
                  <Phone className="size-3.5 text-gold" aria-hidden="true" />
                  {SITE.phone}
                </a>
              </li>
              <li>
                <a
                  href={SITE.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
                >
                  <Icon name="whatsapp" className="size-3.5 text-gold" />
                  WhatsApp — replies within 24h
                </a>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-3.5 text-gold" aria-hidden="true" />
                {SITE.location}
              </li>
            </ul>

            <div className="mt-5 sm:mt-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Newsletter
              </p>
              <div className="mt-2">
                <NewsletterForm />
              </div>
            </div>
          </div>

          {/* Link columns */}
          {footer.columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {column.title}
              </p>
              <div className="gold-rule mt-3 mb-4 w-16" aria-hidden="true" />
              <ul className="space-y-2 text-xs sm:space-y-2.5 sm:text-sm">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <ALink
                      href={link.href}
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </ALink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Socials */}
        {footer.socialsEnabled ? (
          <div className="mt-8 border-t pt-6 sm:mt-10">
            <ul className="flex flex-wrap items-center gap-2" aria-label="MN.KP on social media">
              {SOCIALS.map((social) => (
                <li key={social.name}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${social.name} (opens in a new tab)`}
                    title={social.name}
                    className="flex size-10 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon name={social.icon} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:mt-8 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {footer.copyright}
          </p>
          <p className="inline-flex items-center gap-1.5">
            <MapPin className="size-3 text-gold" aria-hidden="true" />
            Made with AI in Calicut, Kerala
          </p>
          <nav aria-label="Footer utilities" className="flex items-center gap-4">
            <a href="/sitemap.xml" className="transition-colors hover:text-primary">
              Sitemap
            </a>
            <a href="/llms.txt" className="transition-colors hover:text-primary">
              llms.txt
            </a>
            <ALink href="/legal" className="transition-colors hover:text-primary">
              Policies
            </ALink>
          </nav>
        </div>
      </div>
    </footer>
  );
}
