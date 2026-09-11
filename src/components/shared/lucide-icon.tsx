"use client";

import {
  AtSign,
  BrainCircuit,
  Camera,
  Facebook,
  Globe,
  Home,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Newspaper,
  Pin,
  Rocket,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Twitter,
  User,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icon-by-key resolver for the string icon keys used across the
 * orchestrator-owned registries (NAV_MAIN, MOBILE_TABS, SERVICES, SOCIALS)
 * so those files stay free of React imports.
 */

export const ICON_MAP: Record<string, LucideIcon> = {
  // navigation
  home: Home,
  newspaper: Newspaper,
  "shopping-bag": ShoppingBag,
  sparkles: Sparkles,
  user: User,
  mail: Mail,
  // services
  rocket: Rocket,
  "brain-circuit": BrainCircuit,
  camera: Camera,
  video: Video,
  "trending-up": TrendingUp,
  // socials (lucide has no Pinterest/Threads brand marks — nearest glyphs)
  whatsapp: MessageCircle,
  instagram: Instagram,
  linkedin: Linkedin,
  x: Twitter,
  facebook: Facebook,
  threads: AtSign,
  pinterest: Pin,
  globe: Globe,
};

export interface IconProps {
  name: string;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, className, strokeWidth }: IconProps) {
  const Cmp = ICON_MAP[name] ?? Sparkles;
  return <Cmp aria-hidden="true" className={cn("size-4", className)} strokeWidth={strokeWidth} />;
}
