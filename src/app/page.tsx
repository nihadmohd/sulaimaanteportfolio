import { AppShell } from "@/components/layout/app-shell";

/**
 * MN.KP — single user-facing route ("/").
 * All navigation is hash-based (#/blog/my-slug) and resolved by the client
 * router; every entity still gets a unique, shareable URL. The shell is a
 * client component tree (providers → router → header/main/footer).
 */
export default function Page() {
  return <AppShell />;
}
