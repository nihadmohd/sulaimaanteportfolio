"use client";

import * as React from "react";
import { Check, Copy, Link2, MessageCircle, Share2, Twitter, Facebook, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { SITE } from "@/lib/constants";

/**
 * SocialShare — Web Share API when available; otherwise a popover with
 * copy-link + X / WhatsApp / LinkedIn / Facebook share intents.
 * Share intents use SITE.url + path (production canonical); the copy-link
 * action copies the CURRENT origin + "#"+path so it works in the sandbox.
 */

export interface SocialShareProps {
  /** Content title to prefill share text. */
  title: string;
  /** Hash-route path, e.g. "/blog/my-slug". */
  path: string;
  /** Optional share message. */
  message?: string;
  className?: string;
}

export function SocialShare({ title, path, message, className }: SocialShareProps) {
  const { toast } = useToast();
  const [canShare, setCanShare] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const shareUrl = `${SITE.url}${cleanPath}`;
  const shareText = message ?? title;

  const copyLink = async () => {
    const sandboxUrl = `${window.location.origin}/#${cleanPath}`;
    try {
      await navigator.clipboard.writeText(sandboxUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied", description: "Paste it anywhere to share this page." });
    } catch {
      toast({
        title: "Could not copy",
        description: "Copy it manually from the address bar.",
        variant: "destructive",
      });
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, text: shareText, url: shareUrl });
    } catch {
      /* user dismissed the share sheet — no-op */
    }
  };

  const intents = [
    {
      label: "Share on X",
      icon: Twitter,
      href: `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: "Share on WhatsApp",
      icon: MessageCircle,
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
    },
    {
      label: "Share on LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: "Share on Facebook",
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
  ];

  if (canShare) {
    return (
      <Button variant="outline" size="sm" onClick={share} className={className}>
        <Share2 className="size-4" aria-hidden="true" />
        Share
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Share2 className="size-4" aria-hidden="true" />
          Share
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Share this page
        </p>
        <div className="gold-rule mt-2 mb-3 w-full" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={typeof window === "undefined" ? shareUrl : `${window.location.origin}/#${cleanPath}`}
            aria-label="Page link"
            className="h-8 text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            variant="secondary"
            size="icon"
            className="size-8 shrink-0"
            onClick={copyLink}
            aria-label="Copy link"
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
        <ul className="mt-3 grid grid-cols-4 gap-1">
          {intents.map(({ label, icon: Icon_, href }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="flex size-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon_ className="size-4" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          Social share links use the production mnkp.dev URL; "Copy link" copies this
          preview link instead.
        </p>
      </PopoverContent>
    </Popover>
  );
}
