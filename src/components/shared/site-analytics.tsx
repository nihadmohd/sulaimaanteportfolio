"use client";

import * as React from "react";
import { CONSENT_CHANGE_EVENT, COOKIE_CONSENT_KEY } from "@/lib/constants";
import { useSettings } from "@/hooks/use-settings";
import { readConsent, type ConsentValue } from "@/components/shared/cookie-consent";

/**
 * SiteAnalytics — injects GA4 (gtag.js), Plausible and Meta Pixel scripts
 * site-wide from the "analytics" settings group (Admin → Settings → Analytics).
 * Renders nothing; mounted once in the app shell next to CookieConsent.
 *
 * Consent contract (honest and simple):
 *  - Owner opt-in: analytics.enabled plus a well-formed, non-empty ID.
 *  - Visitor opt-in (only while the cookie-consent feature is enabled): GA and
 *    Plausible load after the visitor accepts ANALYTICS cookies; Meta Pixel
 *    after MARKETING cookies. Consent is read from localStorage at mount and
 *    re-checked whenever a decision is saved (CONSENT_CHANGE_EVENT) or changed
 *    in another tab (storage event) — accepted consent activates the trackers
 *    immediately, without a reload.
 *  - When the cookie-consent feature is disabled site-wide, settings alone
 *    decide (nothing is withheld from visitors).
 *  - Scripts are injected once per page load (idempotent element ids). A later
 *    consent withdrawal cannot un-load an already-injected tracker — standard
 *    limitation; this component simply stops emitting further events.
 *
 * trackOutboundClicks (default ON) adds one capture-phase listener that reports
 * external/affiliate link clicks to whichever trackers are actually loaded.
 */

/* ------------------------------------------------------------------ */
/* Minimal global typings for the injected trackers (no `any`)         */
/* ------------------------------------------------------------------ */

type TrackerFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: TrackerFn;
    fbq?: TrackerFn;
    _fbq?: unknown;
    plausible?: TrackerFn;
  }
}

/* ------------------------------------------------------------------ */
/* ID validation — malformed values never hit the network             */
/* ------------------------------------------------------------------ */

const GA_ID_RE = /^G-[A-Za-z0-9]{4,}$/;
const PLAUSIBLE_DOMAIN_RE =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const META_PIXEL_ID_RE = /^\d{8,20}$/;

/* ------------------------------------------------------------------ */
/* Idempotent DOM injection helpers                                    */
/* ------------------------------------------------------------------ */

function injectScript(id: string, attrs: Record<string, string>, text?: string): void {
  if (document.getElementById(id)) return;
  const el = document.createElement("script");
  el.id = id;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  if (text !== undefined) el.text = text;
  document.head.appendChild(el);
}

function injectNoscript(id: string, html: string): void {
  if (document.getElementById(id)) return;
  const el = document.createElement("noscript");
  el.id = id;
  el.innerHTML = html;
  document.body.appendChild(el);
}

function injectGoogleAnalytics(id: string): void {
  injectScript("mnkp-ga-src", {
    src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
    async: "",
  });
  injectScript(
    "mnkp-ga-init",
    {},
    [
      "window.dataLayer = window.dataLayer || [];",
      "function gtag(){dataLayer.push(arguments);}",
      "window.gtag = gtag;",
      "gtag('js', new Date());",
      `gtag('config', ${JSON.stringify(id)}, { anonymize_ip: true });`,
    ].join("\n")
  );
}

function injectPlausible(domain: string): void {
  injectScript("mnkp-plausible", {
    src: "https://plausible.io/js/script.js",
    "data-domain": domain,
    defer: "",
  });
}

function injectMetaPixel(pixelId: string): void {
  injectScript(
    "mnkp-meta-pixel",
    {},
    [
      "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?",
      "n.callMethod.apply(n,arguments):n.queue.push(arguments)};",
      "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';",
      "n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;",
      "s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,",
      "document,'script','https://connect.facebook.net/en_US/fbevents.js');",
      `fbq('init', ${JSON.stringify(pixelId)});`,
      "fbq('track', 'PageView');",
    ].join("\n")
  );
  injectNoscript(
    "mnkp-meta-pixel-noscript",
    `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${encodeURIComponent(
      pixelId
    )}&ev=PageView&noscript=1" />`
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface LiveTrackers {
  ga: boolean;
  plausible: boolean;
  meta: boolean;
}

export function SiteAnalytics() {
  const settings = useSettings();
  /** undefined = not read yet (pre-hydration); null = no decision stored. */
  const [consent, setConsent] = React.useState<ConsentValue | null | undefined>(undefined);
  const [live, setLive] = React.useState<LiveTrackers>({ ga: false, plausible: false, meta: false });

  React.useEffect(() => {
    setConsent(readConsent());
    const onConsentChange = (event: Event) => {
      const detail = (event as CustomEvent<ConsentValue | null | undefined>).detail;
      setConsent(detail === undefined ? readConsent() : detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === COOKIE_CONSENT_KEY) setConsent(readConsent());
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, onConsentChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, onConsentChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  React.useEffect(() => {
    if (consent === undefined) return;
    const analytics = settings.data?.analytics;
    if (!analytics?.enabled) return;

    // While the cookie-consent feature is on, visitors must have accepted the
    // matching channel; with the feature off, settings alone decide.
    const consentRequired = settings.data?.features?.cookieConsent !== false;
    const analyticsAllowed = !consentRequired || consent?.analytics === true;
    const marketingAllowed = !consentRequired || consent?.marketing === true;

    const next: LiveTrackers = { ...live };

    const gaId = (analytics.googleAnalyticsId ?? "").trim();
    if (analyticsAllowed && !live.ga && GA_ID_RE.test(gaId)) {
      injectGoogleAnalytics(gaId);
      next.ga = true;
    }

    const domain = (analytics.plausibleDomain ?? "").trim();
    if (analyticsAllowed && !live.plausible && PLAUSIBLE_DOMAIN_RE.test(domain)) {
      injectPlausible(domain);
      next.plausible = true;
    }

    const pixelId = (analytics.metaPixelId ?? "").trim();
    if (marketingAllowed && !live.meta && META_PIXEL_ID_RE.test(pixelId)) {
      injectMetaPixel(pixelId);
      next.meta = true;
    }

    if (next.ga !== live.ga || next.plausible !== live.plausible || next.meta !== live.meta) {
      setLive(next);
    }
  }, [consent, settings.data, live]);

  const trackOutbound =
    settings.data?.analytics?.enabled === true &&
    settings.data?.analytics?.trackOutboundClicks !== false &&
    (live.ga || live.plausible || live.meta);

  React.useEffect(() => {
    if (!trackOutbound) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const raw = anchor.getAttribute("href") ?? "";
      if (!/^https?:/i.test(raw)) return;
      let url: URL;
      try {
        url = new URL(raw, window.location.href);
      } catch {
        return;
      }
      if (url.hostname === window.location.hostname) return;
      if (typeof window.gtag === "function") {
        window.gtag("event", "click", {
          event_category: "outbound",
          event_label: url.href,
          transport_type: "beacon",
        });
      }
      if (typeof window.plausible === "function") {
        window.plausible("Outbound Links: Click", { props: { url: url.href } });
      }
      if (typeof window.fbq === "function") {
        window.fbq("trackCustom", "OutboundClick", { url: url.href });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [trackOutbound]);

  return null;
}
