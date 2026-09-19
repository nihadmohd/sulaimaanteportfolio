"use client";

import * as React from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ALink } from "@/components/router/link";
import { useUiStore } from "@/stores/ui-store";
import { useSettings } from "@/hooks/use-settings";
import { CONSENT_CHANGE_EVENT, COOKIE_CONSENT_KEY } from "@/lib/constants";

/**
 * CookieConsent — bottom banner (above the mobile tab bar) + preferences dialog.
 * Consent is persisted to localStorage under COOKIE_CONSENT_KEY:
 *   { necessary: true, analytics: boolean, marketing: boolean, decidedAt: number }
 * Slides in 800ms after load only when nothing is stored yet.
 * Every decision also dispatches CONSENT_CHANGE_EVENT on window so the
 * analytics loaders (site-analytics.tsx) activate immediately.
 */

export interface ConsentValue {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: number;
}

export function readConsent(): ConsentValue | null {
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentValue>;
    if (typeof parsed.analytics !== "boolean") return null;
    return {
      necessary: true,
      analytics: parsed.analytics,
      marketing: !!parsed.marketing,
      decidedAt: Number(parsed.decidedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const { cookiePrefsOpen, setCookiePrefsOpen } = useUiStore();
  const settings = useSettings();
  const [visible, setVisible] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  /** Banner only exists while the cookie-consent feature is enabled. */
  const consentSystemOn = settings.data?.features?.cookieConsent !== false;

  React.useEffect(() => {
    if (!consentSystemOn) return;
    if (readConsent()) return;
    const timer = window.setTimeout(() => setVisible(true), 800);
    return () => window.clearTimeout(timer);
  }, [consentSystemOn]);

  const persist = (value: ConsentValue) => {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(value));
    } catch {
      /* storage unavailable — consent stays session-only */
    }
    window.dispatchEvent(new CustomEvent<ConsentValue>(CONSENT_CHANGE_EVENT, { detail: value }));
    setVisible(false);
    setCookiePrefsOpen(false);
  };

  const acceptAll = () =>
    persist({ necessary: true, analytics: true, marketing: true, decidedAt: Date.now() });
  const rejectNonEssential = () =>
    persist({ necessary: true, analytics: false, marketing: false, decidedAt: Date.now() });
  const savePreferences = () =>
    persist({ necessary: true, analytics, marketing, decidedAt: Date.now() });

  if ((!visible && !cookiePrefsOpen) || !consentSystemOn) return null;

  return (
    <>
      {visible ? (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:bottom-6 md:px-6 md:pb-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-gold/40 bg-card/95 p-4 shadow-lg backdrop-blur-md sm:flex-row sm:items-center">
            <Cookie className="size-5 shrink-0 text-gold" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Cookies on MN.KP</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                I use necessary cookies to run the platform, plus optional analytics and
                marketing cookies.{" "}
                <ALink href="/legal/cookie-policy" className="font-medium text-gold hover:underline">
                  Cookie policy
                </ALink>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const stored = readConsent();
                  setAnalytics(stored?.analytics ?? false);
                  setMarketing(stored?.marketing ?? false);
                  setCookiePrefsOpen(true);
                }}
              >
                Customize
              </Button>
              <Button size="sm" variant="outline" onClick={rejectNonEssential}>
                Reject optional
              </Button>
              <Button size="sm" onClick={acceptAll} className="sm:min-w-24">
                Accept all
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={cookiePrefsOpen} onOpenChange={setCookiePrefsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Choose what MN.KP may store on this device. You can change this anytime from the
              cookie policy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Necessary</Label>
                <p className="text-xs text-muted-foreground">
                  Sign-in sessions and platform security. Always on.
                </p>
              </div>
              <Switch checked disabled aria-label="Necessary cookies (always on)" />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Analytics</Label>
                <p className="text-xs text-muted-foreground">
                  Anonymous traffic stats that help me improve content.
                </p>
              </div>
              <Switch
                checked={analytics}
                onCheckedChange={setAnalytics}
                aria-label="Analytics cookies"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Marketing</Label>
                <p className="text-xs text-muted-foreground">
                  Occasional product and service recommendations.
                </p>
              </div>
              <Switch
                checked={marketing}
                onCheckedChange={setMarketing}
                aria-label="Marketing cookies"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={rejectNonEssential}>
              Reject optional
            </Button>
            <Button variant="outline" size="sm" onClick={acceptAll}>
              Accept all
            </Button>
            <Button size="sm" onClick={savePreferences}>
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
